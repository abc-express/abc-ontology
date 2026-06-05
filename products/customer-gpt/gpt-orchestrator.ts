import type { EntityRecord } from "@daemon/ontology";
import type { EntityId, OntologyId } from "@daemon/platform-types";
import { defaultOntology } from "@daemon/ontology";
import { DaemonError, ErrorCodes } from "@daemon/platform-types";
import type { ProductRuntime } from "../shared/product-runtime.js";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import {
  createChatOpenRouter,
  chatOpenRouterAsLlm,
  resolveOpenRouterApiKey,
  type TextLlm,
} from "../ontology-query/llm.js";
import { createOpenRouterModel } from "../shared/openrouter-model.js";
import { iterateLlmStream } from "../shared/llm-stream.js";
import type { AgentStreamChunk } from "../agent-worker/run-agent-worker.js";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface GptReply {
  message: string;
  citations: string[];
  guardEffect: "allow" | "deny";
}

export interface GptChatRequest {
  turns: ChatTurn[];
  ontologyId?: OntologyId;
  limit?: number;
  /** Pre-loaded context; when omitted, retrieval runs from the last user turn. */
  context?: EntityRecord[];
}

/**
 * Customer-facing Q&A over ontology context with hybrid retrieval and optional LLM.
 */
export class GptOrchestrator {
  private readonly llm: TextLlm | null;

  constructor(
    private readonly runtime: ProductRuntime,
    llm?: TextLlm | null,
  ) {
    if (llm !== undefined) {
      this.llm = llm;
    } else if (resolveOpenRouterApiKey()) {
      try {
        this.llm = chatOpenRouterAsLlm(createChatOpenRouter());
      } catch {
        this.llm = null;
      }
    } else {
      this.llm = null;
    }
  }

  async converse(req: GptChatRequest): Promise<GptReply> {
    this.runtime.assertAllowed("chat", "customer-gpt");
    const lastUser = [...req.turns].reverse().find((t) => t.role === "user");
    if (!lastUser?.content.trim()) {
      throw new DaemonError(ErrorCodes.VALIDATION, "user message required", 400);
    }
    const scan = this.runtime.promptGuard.scan(lastUser.content);
    if (scan.effect === "deny") {
      return {
        message: "I cannot process that request.",
        citations: [],
        guardEffect: "deny",
      };
    }

    const context =
      req.context ??
      (await this.retrieveContext(lastUser.content, req.ontologyId, req.limit));
    const citations = context.map((r) => `${r.ontologyId}/${r.entityId}`);

    if (this.llm) {
      return this.answerWithLlm(lastUser.content, context, citations);
    }
    return this.answerDeterministic(context, citations);
  }

  async *converseStream(req: GptChatRequest): AsyncGenerator<AgentStreamChunk> {
    this.runtime.assertAllowed("chat", "customer-gpt");
    const lastUser = [...req.turns].reverse().find((t) => t.role === "user");
    if (!lastUser?.content.trim()) {
      yield {
        event: "error",
        data: { type: "error", message: "user message required" },
      };
      return;
    }
    const scan = this.runtime.promptGuard.scan(lastUser.content);
    if (scan.effect === "deny") {
      yield {
        event: "done",
        data: {
          message: "I cannot process that request.",
          citations: [],
          guardEffect: "deny",
        },
      };
      return;
    }

    const context =
      req.context ??
      (await this.retrieveContext(lastUser.content, req.ontologyId, req.limit));
    const citations = context.map((r) => `${r.ontologyId}/${r.entityId}`);

    if (!resolveOpenRouterApiKey()) {
      const det = this.answerDeterministic(context, citations);
      yield { event: "token", data: { type: "token", text: det.message } };
      yield { event: "done", data: { ...det, guardEffect: "allow" as const } };
      return;
    }

    const contextBlock =
      context.length === 0
        ? "No entity records."
        : context
            .map(
              (r) =>
                `- ${r.entityType ?? "Entity"} ${r.entityId}: ${JSON.stringify(r.properties).slice(0, 400)}`,
            )
            .join("\n");
    const system = `You answer questions using only the provided ontology entity context. Cite entity ids when relevant. If context is empty, say you have no matching records.`;
    const user = `Question: ${lastUser.content}\n\nContext:\n${contextBlock}`;

    const model = createOpenRouterModel();
    const llmStream = await model.stream([
      new SystemMessage(system),
      new HumanMessage(user),
    ]);
    let accumulated = "";
    for await (const token of iterateLlmStream(llmStream)) {
      accumulated += token.text;
      yield { event: "token", data: token };
    }
    yield {
      event: "done",
      data: {
        message: accumulated || "No response.",
        citations,
        guardEffect: "allow",
      },
    };
  }

  private async retrieveContext(
    query: string,
    ontologyIdOpt?: OntologyId,
    limit = 8,
  ): Promise<EntityRecord[]> {
    const ont = ontologyIdOpt ?? defaultOntology();
    if (this.runtime.search && this.runtime.scope) {
      const hits = await this.runtime.search.search(this.runtime.scope, {
        query,
        limit,
        ontologyId: ont,
      });
      const records: EntityRecord[] = [];
      for (const hit of hits) {
        const record = this.runtime.store.get(
          this.runtime.scope,
          hit.ontologyId as OntologyId,
          hit.entityId as EntityId,
        );
        if (record) records.push(record);
      }
      if (records.length > 0) return records;
    }
    return [];
  }

  private answerDeterministic(
    context: EntityRecord[],
    citations: string[],
  ): GptReply {
    const summary =
      context.length === 0
        ? "No matching ontology entities were found for this question."
        : context
            .slice(0, 5)
            .map(
              (r) =>
                `${r.entityId}: ${JSON.stringify(r.properties).slice(0, 120)}`,
            )
            .join("\n");
    return {
      message: `Based on ${context.length} entity record(s):\n${summary}`,
      citations,
      guardEffect: "allow",
    };
  }

  private async answerWithLlm(
    question: string,
    context: EntityRecord[],
    citations: string[],
  ): Promise<GptReply> {
    const llm = this.llm;
    if (!llm || !resolveOpenRouterApiKey()) {
      return this.answerDeterministic(context, citations);
    }
    const contextBlock =
      context.length === 0
        ? "No entity records."
        : context
            .map(
              (r) =>
                `- ${r.entityType ?? "Entity"} ${r.entityId}: ${JSON.stringify(r.properties).slice(0, 400)}`,
            )
            .join("\n");
    const system = `You answer questions using only the provided ontology entity context. Cite entity ids when relevant. If context is empty, say you have no matching records.`;
    const user = `Question: ${question}\n\nContext:\n${contextBlock}`;
    try {
      const message = await llm.complete(system, user);
      return { message, citations, guardEffect: "allow" };
    } catch {
      return this.answerDeterministic(context, citations);
    }
  }
}
