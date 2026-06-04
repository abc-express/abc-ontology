import type { OntologyScope } from "@daemon/context-ports";
import { buildPackGraphSchema } from "@daemon/ontology/graph-schema/pack-graph-schema.js";
import type { Neo4jGraphStore } from "@daemon/data-platform/graph-store/neo4j-graph-store";
import {
  chatOpenRouterAsLlm,
  createChatOpenRouter,
  type TextLlm,
} from "./llm.js";

export type { TextLlm } from "./llm.js";
import { runOntologyQueryGraph } from "./graph.js";

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
};

export class OntologyQueryChain {
  private readonly schemaSummary = buildPackGraphSchema().promptSchemaSummary;

  constructor(private readonly options: OntologyQueryChainOptions) {}

  static fromEnv(
    store: Neo4jGraphStore,
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
    });
  }

  async ask(input: AskOntologyQuestionInput): Promise<AskOntologyQuestionResult> {
    const llm = this.options.llm ?? chatOpenRouterAsLlm(createChatOpenRouter());
    const final = await runOntologyQueryGraph(
      { store: this.options.store, llm },
      {
        question: input.question,
        tenantId: input.scope.tenantId,
        domainId: input.scope.domainId,
        schemaSummary: this.schemaSummary,
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
