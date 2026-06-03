import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ApprovalGates } from "./approval-gates.js";

describe("ApprovalGates", () => {
  const gates = new ApprovalGates([{ field: "amount", threshold: 1000 }], 2);

  it("passes through writes below threshold", () => {
    const d = gates.evaluate({ patch: { amount: 500 }, approvals: [] });
    assert.equal(d.requiresApproval, false);
    assert.equal(d.approved, true);
  });

  it("requires approvals when threshold exceeded", () => {
    const d = gates.evaluate({ patch: { amount: 5000 }, approvals: ["a"] });
    assert.equal(d.requiresApproval, true);
    assert.equal(d.approved, false);
    assert.equal(d.reasons.length, 1);
  });

  it("approves once enough approvals are present", () => {
    const d = gates.evaluate({ patch: { amount: 5000 }, approvals: ["a", "b"] });
    assert.equal(d.approved, true);
  });
});
