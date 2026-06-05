import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { routeIntentHeuristic } from "./router.js";

describe("routeIntentHeuristic", () => {
  it("routes graph questions to ontology_nl", () => {
    assert.equal(
      routeIntentHeuristic("How many entities are linked in the graph?"),
      "ontology_nl",
    );
  });

  it("routes lookup questions to tool_research", () => {
    assert.equal(
      routeIntentHeuristic("search for shipments with entity id SH-1"),
      "tool_research",
    );
  });

  it("routes long compare prompts to parallel", () => {
    const msg =
      "Compare and correlate graph relationships and also search for entity id " +
      "across multiple domains with detailed linkage analysis and count";
    assert.equal(routeIntentHeuristic(msg), "parallel");
  });

  it("defaults to rag_chat for generic chat", () => {
    assert.equal(routeIntentHeuristic("hello there"), "rag_chat");
  });
});
