import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SemanticIndex, tokenize } from "./semantic-index.js";

describe("SemanticIndex", () => {
  it("tokenizes and drops single-char noise", () => {
    assert.deepEqual(tokenize("Hello, a World!"), ["hello", "world"]);
  });

  it("indexes documents and looks up by token", () => {
    const idx = new SemanticIndex();
    idx.add({ id: "1", text: "ontology registry" });
    idx.add({ id: "2", text: "vector registry" });
    assert.deepEqual(idx.documentsFor("registry").sort(), ["1", "2"]);
    assert.deepEqual(idx.documentsFor("ontology"), ["1"]);
  });

  it("produces a non-zero score for matching terms", () => {
    const idx = new SemanticIndex();
    idx.add({ id: "1", text: "alpha beta beta" });
    assert.ok(idx.score("1", ["beta"]) > idx.score("1", ["alpha"]));
  });
});
