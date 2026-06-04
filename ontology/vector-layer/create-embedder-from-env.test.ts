import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EmbeddingPipeline } from "./embedding-pipeline.js";
import {
  createEmbedderFromEnv,
  isAsyncEmbedder,
} from "./create-embedder-from-env.js";

describe("createEmbedderFromEnv", () => {
  it("defaults to deterministic embedder", () => {
    const embedder = createEmbedderFromEnv({});
    assert.ok(embedder instanceof EmbeddingPipeline);
    assert.equal(isAsyncEmbedder(embedder), false);
    const v = embedder.embed("hello");
    assert.equal(v.length, embedder.dimension);
  });

  it("rejects unknown provider", () => {
    assert.throws(
      () => createEmbedderFromEnv({ DAEMON_EMBEDDING_PROVIDER: "unknown" }),
      /unsupported DAEMON_EMBEDDING_PROVIDER/,
    );
  });

  it("requires API key for openrouter", () => {
    assert.throws(
      () =>
        createEmbedderFromEnv({
          DAEMON_EMBEDDING_PROVIDER: "openrouter",
          DAEMON_EMBEDDING_DIMENSION: "8",
        }),
      /OPENROUTER_API_KEY/,
    );
  });
});
