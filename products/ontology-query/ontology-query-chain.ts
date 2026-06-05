import type { OntologyScope } from "@daemon/context-ports";
import { buildPackGraphSchema } from "@daemon/ontology/graph-schema/pack-graph-schema.js";
import type { Neo4jGraphStore } from "@daemon/data-platform/graph-store/neo4j-graph-store";
import {
  chatOpenRouterAsLlm,
  createChatOpenRouter,
  type TextLlm,
} from "./llm.js";

export type { TextLlm } from "./llm.js";
import { buildOntologyQueryGraph, runOntologyQueryGraph } from "./graph.js";

export type OntologyQueryStreamChunk = {
  event: "token" | "tool_start" | "tool_end" | "node" | "done" | "error";
  data: unknown;
};

export type AskOntologyQuestionInput = {
  question: string;
  scope: OntologyScope;
  ontologyId?: string;
};

export type AskOntologyQuestionResult = {
  answer: string;
  cypher?: string;
  resultPreview?: Record<string, unknown>[];
  error?: string;
};

export type OntologyQueryChainOptions = {
  store: Neo4jGraphStore;
  llm?: TextLlm;
  includeCypherInResponse?: boolean;
  /** When set, schema summary follows merged pack for the request domain (extensions included). */
  resolveSchemaSummary?: (scope: OntologyScope) => string;
};

export class OntologyQueryChain {
  private readonly defaultSchemaSummary =
    buildPackGraphSchema().promptSchemaSummary;

  constructor(private readonly options: OntologyQueryChainOptions) {}

  static fromEnv(
    store: Neo4jGraphStore,
    options: Omit<OntologyQueryChainOptions, "store" | "llm"> = {},
    env: NodeJS.ProcessEnv = process.env,
  ): OntologyQueryChain {
    const llm = chatOpenRouterAsLlm(createChatOpenRouter(env));
    const includeCypherInResponse =
      env.DAEMON_ONTOLOGY_QUERY_EXPOSE_CYPHER === "1" ||
      env.NODE_ENV !== "production";
    return new OntologyQueryChain({
      store,
      llm,
      includeCypherInResponse,
      ...options,
    });
  }

  async ask(input: AskOntologyQuestionInput): Promise<AskOntologyQuestionResult> {
    const llm = this.options.llm ?? chatOpenRouterAsLlm(createChatOpenRouter());
    const schemaSummary =
      this.options.resolveSchemaSummary?.(input.scope) ??
      this.defaultSchemaSummary;
    const final = await runOntologyQueryGraph(
      { store: this.options.store, llm },
      {
        question: input.question,
        tenantId: input.scope.tenantId,
        domainId: input.scope.domainId,
        schemaSummary,
        cypher: undefined,
        cypherParams: {
          tenantId: input.scope.tenantId,
          domainId: input.scope.domainId,
        },
        rawResult: [],
        answer: undefined,
        error: undefined,
      },
    );

    const preview = (final.rawResult ?? []).slice(0, 10);
    return {
      answer: final.answer ?? "No answer generated.",
      cypher: this.options.includeCypherInResponse ? final.cypher : undefined,
      resultPreview: preview.length > 0 ? preview : undefined,
      error: final.error,
    };
  }

  async *askStream(
    input: AskOntologyQuestionInput,
  ): AsyncGenerator<OntologyQueryStreamChunk> {
    const llm = this.options.llm ?? chatOpenRouterAsLlm(createChatOpenRouter());
    const schemaSummary =
      this.options.resolveSchemaSummary?.(input.scope) ??
      this.defaultSchemaSummary;
    const app = buildOntologyQueryGraph({
      store: this.options.store,
      llm,
    });
    const initial = {
      question: input.question,
      tenantId: input.scope.tenantId,
      domainId: input.scope.domainId,
      schemaSummary,
      cypher: undefined,
      cypherParams: {
        tenantId: input.scope.tenantId,
        domainId: input.scope.domainId,
      },
      rawResult: [],
      answer: undefined,
      error: undefined,
    };
    try {
      const stream = await app.stream(initial, { streamMode: "updates" });
      let state = { ...initial };
      for await (const update of stream) {
        if (!update || typeof update !== "object") continue;
        for (const [node, partial] of Object.entries(update)) {
          state = { ...state, ...(partial as object) };
          yield {
            event: "node",
            data: { type: "node", name: node, status: "end", data: partial },
          };
          if (node === "generateAnswer" && state.answer) {
            yield {
              event: "token",
              data: { type: "token", text: state.answer },
            };
          }
        }
      }
      const preview = (state.rawResult ?? []).slice(0, 10);
      yield {
        event: "done",
        data: {
          answer: state.answer ?? "No answer generated.",
          cypher: this.options.includeCypherInResponse ? state.cypher : undefined,
          resultPreview: preview.length > 0 ? preview : undefined,
          error: state.error,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      yield { event: "error", data: { type: "error", message } };
    }
  }
}

export function isOntologyQueryEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    env.DAEMON_ONTOLOGY_QUERY_ENABLED === "1" &&
    Boolean(env.DAEMON_NEO4J_URI) &&
    Boolean(env.OPENROUTER_API_KEY ?? env.DAEMON_OPENROUTER_API_KEY)
  );
}
