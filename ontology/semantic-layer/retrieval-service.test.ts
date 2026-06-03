import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SemanticIndex } from "./semantic-index.js";
import { RetrievalService } from "./retrieval-service.js";

describe("RetrievalService", () => {
  const index = new SemanticIndex();
  index.add({ id: "a", text: "ontology registry namespace" });
  index.add({ id: "b", text: "vector store similarity" });
  index.add({ id: "c", text: "ontology vector hybrid" });
  const svc = new RetrievalService(index);

  it("returns only documents matching the query", () => {
    const hits = svc.search("ontology");
    const ids = hits.map((h) => h.id).sort();
    assert.deepEqual(ids, ["a", "c"]);
  });

  it("ranks higher term frequency first", () => {
    const hits = svc.search("vector store");
    assert.equal(hits[0]?.id, "b");
  });

  it("respects the limit", () => {
    assert.equal(svc.search("ontology", 1).length, 1);
  });

  it("returns empty for non-matching queries", () => {
    assert.deepEqual(svc.search("nonexistent"), []);
  });
});
