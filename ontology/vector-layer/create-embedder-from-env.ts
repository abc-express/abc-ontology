import { EmbeddingPipeline } from "./embedding-pipeline.js";
import type { TextEmbedder } from "./text-embedder.js";

const DEFAULT_DIMENSION = 64;

function resolveOpenRouterApiKey(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  return env.OPENROUTER_API_KEY ?? env.DAEMON_OPENROUTER_API_KEY;
}

function parseDimension(env: NodeJS.ProcessEnv): number {
  const raw = env.DAEMON_EMBEDDING_DIMENSION;
  if (!raw) return DEFAULT_DIMENSION;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) {
    throw new Error(`invalid DAEMON_EMBEDDING_DIMENSION: ${raw}`);
  }
  return Math.floor(n);
}

export interface AsyncTextEmbedder extends TextEmbedder {
  embedAsync(text: string): Promise<number[]>;
}

class OpenRouterTextEmbedder implements AsyncTextEmbedder {
  readonly dimension: number;

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    dimension: number,
  ) {
    this.dimension = dimension;
  }

  embed(_text: string): number[] {
    throw new Error(
      "OpenRouter embeddings are async; use embedAsync or deterministic provider for sync paths",
    );
  }

  async embedAsync(text: string): Promise<number[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: this.model, input: text }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(
          `OpenRouter embeddings failed: ${res.status} ${body.slice(0, 200)}`,
        );
      }
      const json = (await res.json()) as {
        data?: Array<{ embedding?: number[] }>;
      };
      const vector = json.data?.[0]?.embedding;
      if (!Array.isArray(vector) || vector.length === 0) {
        throw new Error("OpenRouter embeddings returned empty vector");
      }
      if (vector.length !== this.dimension) {
        throw new Error(
          `embedding dimension ${vector.length} does not match DAEMON_EMBEDDING_DIMENSION ${this.dimension}`,
        );
      }
      return vector.map((v) => Number(v));
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function isAsyncEmbedder(
  embedder: TextEmbedder,
): embedder is AsyncTextEmbedder {
  return (
    typeof (embedder as AsyncTextEmbedder).embedAsync === "function"
  );
}

export function createEmbedderFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): TextEmbedder {
  const provider = (env.DAEMON_EMBEDDING_PROVIDER ?? "deterministic").toLowerCase();
  if (provider === "deterministic") {
    return new EmbeddingPipeline();
  }
  if (provider === "openrouter") {
    const apiKey = resolveOpenRouterApiKey(env);
    if (!apiKey) {
      throw new Error(
        "DAEMON_EMBEDDING_PROVIDER=openrouter requires OPENROUTER_API_KEY or DAEMON_OPENROUTER_API_KEY",
      );
    }
    const model =
      env.DAEMON_EMBEDDING_MODEL ?? "openai/text-embedding-3-small";
    const dimension = parseDimension(env);
    return new OpenRouterTextEmbedder(apiKey, model, dimension);
  }
  throw new Error(
    `unsupported DAEMON_EMBEDDING_PROVIDER: ${provider} (use deterministic or openrouter)`,
  );
}
