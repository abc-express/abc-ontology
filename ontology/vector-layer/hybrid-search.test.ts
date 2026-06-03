import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SemanticIndex } from "../semantic-layer/semantic-index.js";
import { RetrievalService } from "../semantic-layer/retrieval-service.js";
import { EmbeddingPipeline } from "./embedding-pipeline.js";
import { VectorStore } from "./vector-store.js";
import { HybridSearch } from "./hybrid-search.js";

describe("HybridSearch", () => {
  const docs = [
    { id: "a", text: "ontology registry namespace versioning" },
    { id: "b", text: "vector store cosine similarity search" },
  ];
  const index = new SemanticIndex();
  const embedder = new EmbeddingPipeline(64);
  const store = new VectorStore(64);
  for (const d of docs) {
    index.add(d);
    store.upsert({ id: d.id, vector: embedder.embed(d.text) });
  }
  const hybrid = new HybridSearch(
    new RetrievalService(index),
    store,
    embedder,
    0.5,
  );

  it("ranks the topically closest document first", () => {
    const hits = hybrid.search("vector similarity search");
    assert.equal(hits[0]?.id, "b");
  });

  it("reports both component scores", () => {
    const hits = hybrid.search("ontology registry");
    const top = hits[0];
    assert.ok(top);
    assert.ok(top.keywordScore > 0 || top.vectorScore > 0);
  });

  it("rejects invalid alpha", () => {
    assert.throws(
      () =>
        new HybridSearch(
          new RetrievalService(index),
          store,
          embedder,
          2,
        ),
    );
  });
});
