import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { globalRegistry } from "@daemon/ontology";
import {
  ontologyId,
  entityId,
  type DaemonSession,
  type SessionId,
} from "@daemon/platform-types";
import { AutomationsController } from "./automations.controller.js";
import { AutomationsService } from "./automations.service.js";

function session(): DaemonSession {
  return {
    sessionId: "sess-gw-auto" as SessionId,
    subjectId: "gw",
    tenantId: "default",
    roles: ["operator"],
    issuedAt: new Date().toISOString(),
  };
}

describe("AutomationsController", () => {
  it("run, evaluate, and approve return automation payloads", async () => {
    const ont = ontologyId(`gw-auto-${Date.now()}`);
    const id = entityId("gw-auto-1");
    globalRegistry.register(ont, { status: "open", amount: 50 }, id);
    const controller = new AutomationsController(new AutomationsService());

    const run = await controller.run(session(), {
      steps: [{ id: "s1", action: "notify" }],
      loop: { ontologyId: ont, entityId: id, patch: { status: "done" } },
    });
    assert.equal(run.workflowResults[0], "ok:s1:notify");
    assert.equal(run.loop?.state, "committed");

    const decision = controller.evaluate({
      patch: { amount: 50_000 },
      approvals: [],
    });
    assert.equal(decision.requiresApproval, true);

    const outcome = controller.approve(session(), {
      loop: { ontologyId: ont, entityId: id, patch: { amount: 50, status: "ok" } },
      approvals: ["mgr-1"],
    });
    assert.equal(outcome.state, "committed");
  });
});
