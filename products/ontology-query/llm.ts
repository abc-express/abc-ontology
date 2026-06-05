import type { ChatOpenRouter } from "@langchain/openrouter";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

export {
  buildProviderConfig,
  createChatOpenRouter,
  createOpenRouterModel,
  parseFallbackModels,
  resolveOpenRouterApiKey,
} from "../shared/openrouter-model.js";

export type TextLlm = {
  complete(system: string, user: string): Promise<string>;
};

export function chatOpenRouterAsLlm(model: ChatOpenRouter): TextLlm {
  return {
    async complete(system, user) {
      const response = await model.invoke([
        new SystemMessage(system),
        new HumanMessage(user),
      ]);
      const content = response.content;
      if (typeof content === "string") return content.trim();
      if (Array.isArray(content)) {
        return content
          .map((part) =>
            typeof part === "string"
              ? part
              : "text" in part
                ? String(part.text)
                : "",
          )
          .join("")
          .trim();
      }
      return String(content ?? "").trim();
    },
  };
}

export function extractCypherBlock(text: string): string {
  const marker = "```";
  const lower = text.toLowerCase();
  let from = 0;
  while (from < text.length) {
    const fenceStart = lower.indexOf(marker, from);
    if (fenceStart < 0) break;
    let cursor = fenceStart + marker.length;
    while (cursor < text.length && (text[cursor] === " " || text[cursor] === "\t")) {
      cursor++;
    }
    if (lower.slice(cursor, cursor + 6) === "cypher") {
      cursor += 6;
    }
    while (cursor < text.length && (text[cursor] === " " || text[cursor] === "\t")) {
      cursor++;
    }
    if (cursor < text.length && text[cursor] === "\n") {
      cursor++;
    }
    const fenceEnd = lower.indexOf(marker, cursor);
    if (fenceEnd >= 0) {
      return text.slice(cursor, fenceEnd).trim();
    }
    from = fenceStart + marker.length;
  }
  return text.trim();
}
