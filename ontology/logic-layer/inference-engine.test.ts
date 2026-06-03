import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { InferenceEngine } from "./inference-engine.js";

describe("InferenceEngine", () => {
  const engine = new InferenceEngine([
    {
      id: "transitive",
      when: [
        { predicate: "edge", args: ["a", "b"] },
        { predicate: "edge", args: ["b", "c"] },
      ],
      then: [{ predicate: "path", args: ["a", "c"] }],
    },
  ]);

  it("answers true for a derivable query", () => {
    const facts = [
      { predicate: "edge", args: ["a", "b"] },
      { predicate: "edge", args: ["b", "c"] },
    ];
    assert.equal(engine.ask(facts, { predicate: "path", args: ["a", "c"] }), true);
  });

  it("answers false for a non-derivable query", () => {
    assert.equal(
      engine.ask([{ predicate: "edge", args: ["a", "b"] }], {
        predicate: "path",
        args: ["a", "c"],
      }),
      false,
    );
  });
});
