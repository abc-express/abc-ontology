import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EmbeddingPipeline } from "./embedding-pipeline.js";

describe("EmbeddingPipeline", () => {
  it("produces a vector of the configured dimension", () => {
    const p = new EmbeddingPipeline(32);
    assert.equal(p.embed("hello world").length, 32);
  });

  it("is deterministic for the same input", () => {
    const p = new EmbeddingPipeline();
    assert.deepEqual(p.embed("ontology registry"), p.embed("ontology registry"));
  });

  it("L2-normalizes non-empty embeddings", () => {
    const p = new EmbeddingPipeline();
    const v = p.embed("alpha beta gamma");
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    assert.ok(Math.abs(norm - 1) < 1e-9);
  });

  it("returns a zero vector for empty text", () => {
    const v = new EmbeddingPipeline(8).embed("");
    assert.ok(v.every((x) => x === 0));
  });
});
