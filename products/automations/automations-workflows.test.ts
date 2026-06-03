import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { globalRegistry } from "@daemon/ontology";
import {
  ontologyId,
  entityId,
  type DaemonSession,
  type SessionId,
} from "@daemon/platform-types";
import { AutomationsWorkflows } from "./automations-workflows.js";

function session(): DaemonSession {
  return {
    sessionId: "sess-flows" as SessionId,
    subjectId: "ops",
    tenantId: "default",
    roles: ["operator"],
    issuedAt: new Date().toISOString(),
  };
}

describe("AutomationsWorkflows", () => {
  it("runs workflow with optional loop", async () => {
    const ont = ontologyId("prod-flows");
    const id = entityId("flows-1");
    globalRegistry.register(ont, { status: "open" }, id);
    const flows = new AutomationsWorkflows();
    const result = await flows.run(
      session(),
      [{ id: "s1", action: "notify" }],
      { ontologyId: ont, entityId: id, patch: { status: "done" } },
    );
    assert.equal(result.workflowResults[0], "ok:s1:notify");
    assert.equal(result.loop?.state, "committed");
  });

  it("evaluates approval without writing", () => {
    const flows = new AutomationsWorkflows();
    const decision = flows.evaluateApproval({ amount: 50_000 }, []);
    assert.equal(decision.requiresApproval, true);
    assert.equal(decision.approved, false);
  });
});
