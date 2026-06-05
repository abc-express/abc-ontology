import { ChatOpenRouter } from "@langchain/openrouter";
import type { OpenRouter } from "@langchain/openrouter";

export function resolveOpenRouterApiKey(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const key =
    env.OPENROUTER_API_KEY?.trim() ||
    env.DAEMON_OPENROUTER_API_KEY?.trim();
  return key || undefined;
}

function parseCsvList(value: string | undefined): string[] | undefined {
  if (!value?.trim()) return undefined;
  const items = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

export function buildProviderConfig(
  env: NodeJS.ProcessEnv = process.env,
): OpenRouter.ProviderPreferences | undefined {
  const dataCollection =
    (env.DAEMON_OPENROUTER_DATA_COLLECTION?.trim() as
      | OpenRouter.DataCollection
      | undefined) ?? "deny";
  const order = parseCsvList(env.DAEMON_OPENROUTER_PROVIDER_ORDER);
  if (!dataCollection && !order) return undefined;
  return {
    data_collection: dataCollection,
    ...(order ? { order } : {}),
  };
}

export function parseFallbackModels(
  env: NodeJS.ProcessEnv = process.env,
): string[] | undefined {
  return parseCsvList(env.DAEMON_OPENROUTER_MODELS);
}

export function createOpenRouterModel(
  env: NodeJS.ProcessEnv = process.env,
): ChatOpenRouter {
  const apiKey = resolveOpenRouterApiKey(env);
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY or DAEMON_OPENROUTER_API_KEY is required");
  }
  const route = env.DAEMON_OPENROUTER_ROUTE?.trim();
  const models = parseFallbackModels(env);
  const provider = buildProviderConfig(env);
  return new ChatOpenRouter({
    model:
      env.DAEMON_ONTOLOGY_QUERY_MODEL ?? "anthropic/claude-sonnet-4.5",
    temperature: 0,
    maxTokens: 2048,
    apiKey,
    siteUrl: env.DAEMON_OPENROUTER_SITE_URL,
    siteName: env.DAEMON_OPENROUTER_SITE_NAME ?? "daemon-sdk",
    streamUsage: true,
    ...(provider ? { provider } : {}),
    ...(models ? { models } : {}),
    ...(route === "fallback" ? { route: "fallback" as const } : {}),
  });
}

/** @deprecated Use createOpenRouterModel */
export function createChatOpenRouter(
  env: NodeJS.ProcessEnv = process.env,
): ChatOpenRouter {
  return createOpenRouterModel(env);
}
