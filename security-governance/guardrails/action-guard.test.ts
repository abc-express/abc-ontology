import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DaemonError } from "@daemon/platform-types";
import { ActionGuard } from "./action-guard.js";

const config = {
  approvalThreshold: "high" as const,
  requiredApprovals: 2,
  denylist: ["drop-database"],
};

describe("ActionGuard", () => {
  const guard = new ActionGuard(config);

  it("blocks denylisted actions outright", () => {
    assert.equal(
      guard.evaluate({ action: "drop-database", risk: "low", approvals: [] }).effect,
      "deny",
    );
  });

  it("allows low-risk actions without approvals", () => {
    assert.equal(
      guard.evaluate({ action: "read-report", risk: "low", approvals: [] }).effect,
      "allow",
    );
  });

  it("requires an approval quorum for high-risk actions", () => {
    const denied = guard.evaluate({
      action: "rotate-keys",
      risk: "high",
      approvals: ["alice"],
    });
    assert.equal(denied.effect, "deny");
    const allowed = guard.evaluate({
      action: "rotate-keys",
      risk: "high",
      approvals: ["alice", "bob"],
    });
    assert.equal(allowed.effect, "allow");
  });

  it("counts only distinct approvers", () => {
    const d = guard.evaluate({
      action: "rotate-keys",
      risk: "critical",
      approvals: ["alice", "alice"],
    });
    assert.equal(d.effect, "deny");
  });

  it("assert throws POLICY_DENIED", () => {
    assert.throws(
      () => guard.assert({ action: "drop-database", risk: "low", approvals: [] }),
      (err) => err instanceof DaemonError && err.code === "POLICY_DENIED",
    );
  });
});
