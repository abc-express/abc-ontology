import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PolicyEngine } from "./policy-engine.js";

describe("PolicyEngine", () => {
  it("allows configured entity read", () => {
    const engine = PolicyEngine.fromRules([
      { action: "read", resource: "entity", effect: "allow" },
    ]);
    const decision = engine.evaluate("read", "entity");
    assert.equal(decision.effect, "allow");
  });

  it("denies when no rule matches", () => {
    const engine = PolicyEngine.fromRules([]);
    assert.equal(engine.evaluate("delete", "entity").effect, "deny");
  });
});
