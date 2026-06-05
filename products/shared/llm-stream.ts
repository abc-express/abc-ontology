import type { AIMessageChunk } from "@langchain/core/messages";

export type SseTokenPayload = {
  type: "token";
  text: string;
};

export type SseToolPayload = {
  type: "tool_start" | "tool_end";
  name: string;
  input?: unknown;
  output?: unknown;
};

export type SseNodePayload = {
  type: "node";
  name: string;
  status: "start" | "end";
  data?: unknown;
};

export type SseDonePayload = {
  type: "done";
  result?: unknown;
};

export type SseErrorPayload = {
  type: "error";
  message: string;
};

export type SseStreamPayload =
  | SseTokenPayload
  | SseToolPayload
  | SseNodePayload
  | SseDonePayload
  | SseErrorPayload;

export function chunkToTokenText(chunk: AIMessageChunk): string {
  const content = chunk.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === "string"
          ? part
          : "text" in part
            ? String(part.text ?? "")
            : "",
      )
      .join("");
  }
  return String(content ?? "");
}

export async function* iterateLlmStream(
  stream: AsyncIterable<AIMessageChunk>,
): AsyncGenerator<SseTokenPayload> {
  for await (const chunk of stream) {
    const text = chunkToTokenText(chunk);
    if (text) {
      yield { type: "token", text };
    }
  }
}
