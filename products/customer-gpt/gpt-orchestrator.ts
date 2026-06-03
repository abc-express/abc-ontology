import type { EntityRecord } from "@daemon/ontology";
import { DaemonError, ErrorCodes } from "@daemon/platform-types";
import type { ProductRuntime } from "../shared/product-runtime.js";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface GptReply {
  message: string;
  citations: string[];
  guardEffect: "allow" | "deny";
}

/**
 * Customer-facing Q&A over ontology context. Uses PromptGuard on user input and
 * returns a deterministic answer grounded in supplied entity records (no external LLM).
 */
export class GptOrchestrator {
  constructor(private readonly runtime: ProductRuntime) {}

  converse(turns: ChatTurn[], context: EntityRecord[]): GptReply {
    this.runtime.assertAllowed("chat", "customer-gpt");
    const lastUser = [...turns].reverse().find((t) => t.role === "user");
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
    const citations = context.map((r) => `${r.ontologyId}/${r.entityId}`);
    const summary =
      context.length === 0
        ? "No ontology entities were provided for this session."
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
}
