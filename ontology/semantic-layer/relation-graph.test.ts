import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RelationGraph } from "./relation-graph.js";

describe("RelationGraph", () => {
  it("stores edges and lists neighbors by type", () => {
    const g = new RelationGraph();
    g.addEdge("a", "b", "owns");
    g.addEdge("a", "c", "uses");
    assert.equal(g.neighbors("a").length, 2);
    assert.equal(g.neighbors("a", "owns")[0]?.to, "b");
  });

  it("deduplicates identical edges", () => {
    const g = new RelationGraph();
    g.addEdge("a", "b", "owns");
    g.addEdge("a", "b", "owns");
    assert.equal(g.neighbors("a").length, 1);
  });

  it("computes multi-hop reachability", () => {
    const g = new RelationGraph();
    g.addEdge("a", "b", "r");
    g.addEdge("b", "c", "r");
    assert.equal(g.isReachable("a", "c"), true);
    assert.equal(g.isReachable("c", "a"), false);
  });

  it("rejects incomplete edges", () => {
    assert.throws(() => new RelationGraph().addEdge("a", "", "r"));
  });
});
