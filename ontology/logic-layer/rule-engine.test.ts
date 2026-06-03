import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RuleEngine } from "./rule-engine.js";

describe("RuleEngine", () => {
  it("derives new facts via forward chaining", () => {
    const engine = new RuleEngine();
    engine.addRule({
      id: "parent->ancestor",
      when: [{ predicate: "parent", args: ["a", "b"] }],
      then: [{ predicate: "ancestor", args: ["a", "b"] }],
    });
    const result = engine.evaluate([{ predicate: "parent", args: ["a", "b"] }]);
    assert.ok(
      result.some(
        (f) => f.predicate === "ancestor" && f.args.join() === "a,b",
      ),
    );
  });

  it("reaches a fixpoint across chained rules", () => {
    const engine = new RuleEngine();
    engine.addRule({
      id: "r1",
      when: [{ predicate: "p", args: ["x"] }],
      then: [{ predicate: "q", args: ["x"] }],
    });
    engine.addRule({
      id: "r2",
      when: [{ predicate: "q", args: ["x"] }],
      then: [{ predicate: "r", args: ["x"] }],
    });
    const result = engine.evaluate([{ predicate: "p", args: ["x"] }]);
    assert.equal(result.length, 3);
  });

  it("rejects rules without conditions", () => {
    assert.throws(() =>
      new RuleEngine().addRule({ id: "bad", when: [], then: [] }),
    );
  });
});
