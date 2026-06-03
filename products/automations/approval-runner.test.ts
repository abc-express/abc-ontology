import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { globalRegistry } from "@daemon/ontology";
import {
  ontologyId,
  entityId,
  type DaemonSession,
  type SessionId,
} from "@daemon/platform-types";
import { DaemonError } from "@daemon/platform-types";
import { ProductRuntime } from "../shared/product-runtime.js";
import { ApprovalRunner } from "./approval-runner.js";

function session(): DaemonSession {
  return {
    sessionId: "sess-appr" as SessionId,
    subjectId: "approver",
    tenantId: "default",
    roles: ["approver"],
    issuedAt: new Date().toISOString(),
  };
}

describe("ApprovalRunner", () => {
  it("requires approval for large amounts", () => {
    const runner = new ApprovalRunner(new ProductRuntime());
    const decision = runner.evaluate({ amount: 50_000 }, []);
    assert.equal(decision.requiresApproval, true);
    assert.equal(decision.approved, false);
  });

  it("runs loop when approved", () => {
    const ont = ontologyId("prod-appr");
    const id = entityId("appr-1");
    globalRegistry.register(ont, { amount: 100 }, id);
    const runner = new ApprovalRunner(new ProductRuntime());
    const outcome = runner.run({
      loop: {
        session: session(),
        ontologyId: ont,
        entityId: id,
        patch: { amount: 100, status: "approved" },
      },
      approvals: ["manager-1"],
    });
    assert.equal(outcome.state, "committed");
  });

  it("rejects loop without approvals", () => {
    const ont = ontologyId("prod-appr-deny");
    const id = entityId("appr-2");
    globalRegistry.register(ont, { amount: 0 }, id);
    const runner = new ApprovalRunner(new ProductRuntime());
    assert.throws(
      () =>
        runner.run({
          loop: {
            session: session(),
            ontologyId: ont,
            entityId: id,
            patch: { amount: 99_999 },
          },
          approvals: [],
        }),
      (err: unknown) => err instanceof DaemonError,
    );
  });
});
