import { createDeepAgent, type DeepAgent } from "deepagents";
import type { ProductRuntime } from "../shared/product-runtime.js";
import { createOpenRouterModel, resolveOpenRouterApiKey } from "../shared/openrouter-model.js";
import {
  createDaemonReadTools,
  type DaemonToolsOptions,
} from "./daemon-tools.js";

const SYSTEM_PROMPT = `You are a read-only research agent for an ontology platform.
Use search, read_entity, and ontology_ask to gather facts. Never invent entity ids.
Summarize findings with citations (ontologyId/entityId). Do not request writes or ingest.`;

export type CreateAgentWorkerOptions = DaemonToolsOptions & {
  maxSteps?: number;
};

export function createAgentWorker(
  runtime: ProductRuntime,
  options: CreateAgentWorkerOptions = {},
): DeepAgent {
  const tools = createDaemonReadTools(runtime, options);
  const hasKey = Boolean(resolveOpenRouterApiKey());
  if (!hasKey) {
    throw new Error("OPENROUTER_API_KEY or DAEMON_OPENROUTER_API_KEY is required");
  }
  const model = createOpenRouterModel();
  void options.maxSteps;
  return createDeepAgent({
    model,
    tools,
    systemPrompt: SYSTEM_PROMPT,
    subagents: [],
    permissions: [
      { operations: ["read", "write"], paths: ["/**"], mode: "deny" },
    ],
  });
}
