import { HumanMessage } from "@langchain/core/messages";
import type { ProductRuntime } from "../shared/product-runtime.js";
import { resolveOpenRouterApiKey } from "../shared/openrouter-model.js";
import { iterateLlmStream } from "../shared/llm-stream.js";
import { createAgentWorker, type CreateAgentWorkerOptions } from "./create-agent-worker.js";
import type { AgentWorkerReply } from "./schemas.js";

export type AgentWorkerRunInput = {
  message: string;
};

export type AgentStreamChunk = {
  event: "token" | "tool_start" | "tool_end" | "node" | "done" | "error";
  data: unknown;
};

function extractStructuredReply(result: unknown): AgentWorkerReply {
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    if (r.structuredResponse && typeof r.structuredResponse === "object") {
      return r.structuredResponse as AgentWorkerReply;
    }
    if (typeof r.message === "string") {
      return {
        message: r.message,
        citations: Array.isArray(r.citations) ? (r.citations as string[]) : [],
        toolTrace: Array.isArray(r.toolTrace)
          ? (r.toolTrace as AgentWorkerReply["toolTrace"])
          : [],
      };
    }
    const messages = r.messages;
    if (Array.isArray(messages) && messages.length > 0) {
      const last = messages[messages.length - 1] as { content?: unknown };
      const text =
        typeof last.content === "string"
          ? last.content
          : JSON.stringify(last.content ?? "");
      return { message: text, citations: [], toolTrace: [] };
    }
  }
  return { message: String(result ?? ""), citations: [], toolTrace: [] };
}

function guardMessage(runtime: ProductRuntime, message: string): string | null {
  const scan = runtime.promptGuard.scan(message);
  if (scan.effect === "deny") {
    return "I cannot process that request.";
  }
  return null;
}

export async function runAgentWorker(
  runtime: ProductRuntime,
  input: AgentWorkerRunInput,
  options: CreateAgentWorkerOptions = {},
): Promise<AgentWorkerReply> {
  runtime.assertAllowed("chat", "agent-worker");
  const denied = guardMessage(runtime, input.message);
  if (denied) {
    return { message: denied, citations: [], toolTrace: [] };
  }
  if (!resolveOpenRouterApiKey()) {
    return {
      message: "Agent worker requires OPENROUTER_API_KEY.",
      citations: [],
      toolTrace: [],
    };
  }
  const agent = createAgentWorker(runtime, options);
  const maxSteps = Number(process.env.DAEMON_AGENT_MAX_STEPS ?? "8");
  const result = await agent.invoke(
    { messages: [new HumanMessage(input.message)] },
    { recursionLimit: maxSteps },
  );
  return extractStructuredReply(result);
}

export async function* runAgentWorkerStream(
  runtime: ProductRuntime,
  input: AgentWorkerRunInput,
  options: CreateAgentWorkerOptions = {},
): AsyncGenerator<AgentStreamChunk> {
  runtime.assertAllowed("chat", "agent-worker");
  const denied = guardMessage(runtime, input.message);
  if (denied) {
    yield { event: "done", data: { message: denied, citations: [], toolTrace: [] } };
    return;
  }
  if (!resolveOpenRouterApiKey()) {
    yield {
      event: "done",
      data: {
        message: "Agent worker requires OPENROUTER_API_KEY.",
        citations: [],
        toolTrace: [],
      },
    };
    return;
  }
  const agent = createAgentWorker(runtime, options);
  const maxSteps = Number(process.env.DAEMON_AGENT_MAX_STEPS ?? "8");
  try {
    const stream = await agent.stream(
      { messages: [new HumanMessage(input.message)] },
      { streamMode: ["updates", "messages"], recursionLimit: maxSteps },
    );
    let accumulated = "";
    for await (const chunk of stream) {
      if (Array.isArray(chunk)) {
        const [mode, payload] = chunk as [string, unknown];
        if (mode === "messages") {
          const msgChunk = payload as { content?: unknown };
          if (typeof msgChunk?.content === "string" && msgChunk.content) {
            accumulated += msgChunk.content;
            yield {
              event: "token",
              data: { type: "token", text: msgChunk.content },
            };
          }
        } else if (mode === "updates" && payload && typeof payload === "object") {
          for (const [node, update] of Object.entries(
            payload as Record<string, unknown>,
          )) {
            yield {
              event: "node",
              data: { type: "node", name: node, status: "end", data: update },
            };
          }
        }
      }
    }
    yield {
      event: "done",
      data: {
        message: accumulated || "No response.",
        citations: [],
        toolTrace: [],
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    yield { event: "error", data: { type: "error", message } };
  }
}

export async function* streamLlmAnswer(
  _runtime: ProductRuntime,
  system: string,
  user: string,
): AsyncGenerator<AgentStreamChunk> {
  if (!resolveOpenRouterApiKey()) {
    yield { event: "done", data: { message: user.slice(0, 500), citations: [] } };
    return;
  }
  const { createOpenRouterModel } = await import("../shared/openrouter-model.js");
  const { SystemMessage } = await import("@langchain/core/messages");
  const model = createOpenRouterModel();
  const llmStream = await model.stream([
    new SystemMessage(system),
    new HumanMessage(user),
  ]);
  for await (const token of iterateLlmStream(llmStream)) {
    yield { event: "token", data: token };
  }
  yield { event: "done", data: { message: "" } };
}
