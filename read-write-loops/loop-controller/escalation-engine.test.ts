import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EscalationEngine } from "./escalation-engine.js";

describe("EscalationEngine", () => {
  const engine = new EscalationEngine(3, 5);

  it("returns none for a clean loop", () => {
    assert.equal(engine.assess({ failureCount: 0 }), "none");
  });

  it("notifies on first failure or conflict", () => {
    assert.equal(engine.assess({ failureCount: 1 }), "notify");
    assert.equal(engine.assess({ failureCount: 0, conflict: true }), "notify");
  });

  it("pages at the page threshold and halts at the halt threshold", () => {
    assert.equal(engine.assess({ failureCount: 3 }), "page");
    assert.equal(engine.assess({ failureCount: 5 }), "halt");
  });

  it("halts immediately on policy denial", () => {
    assert.equal(engine.assess({ failureCount: 0, policyDenied: true }), "halt");
  });
});
