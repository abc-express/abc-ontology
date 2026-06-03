import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DaemonError } from "@daemon/platform-types";
import { VectorStore, cosineSimilarity } from "./vector-store.js";

describe("VectorStore", () => {
  it("computes cosine similarity", () => {
    assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
    assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  });

  it("returns nearest neighbors ranked by similarity", () => {
    const store = new VectorStore(2);
    store.upsert({ id: "right", vector: [1, 0] });
    store.upsert({ id: "up", vector: [0, 1] });
    store.upsert({ id: "diag", vector: [1, 1] });
    const hits = store.nearest([1, 0], 2);
    assert.equal(hits[0]?.id, "right");
    assert.equal(hits.length, 2);
  });

  it("rejects wrong dimensions on upsert", () => {
    const store = new VectorStore(3);
    assert.throws(() => store.upsert({ id: "x", vector: [1, 2] }), DaemonError);
  });
});
