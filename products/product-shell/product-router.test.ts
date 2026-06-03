import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { globalRegistry } from "@daemon/ontology";
import {
  ontologyId,
  entityId,
  type DaemonSession,
  type SessionId,
} from "@daemon/platform-types";
import { ProductRouter } from "./product-router.js";

function session(): DaemonSession {
  return {
    sessionId: "sess-router-test" as SessionId,
    subjectId: "tester",
    tenantId: "default",
    roles: ["operator"],
    issuedAt: new Date().toISOString(),
  };
}

describe("ProductRouter", () => {
  it("routes analytics search to report", async () => {
    const ont = ontologyId("prod-router");
    globalRegistry.register(ont, { label: "findme" }, entityId("r-1"));
    const report = (await new ProductRouter().dispatch({
      product: "analytics-workflows",
      op: "search",
      query: "findme",
      ontologyId: ont,
    })) as { rowCount: number };
    assert.equal(report.rowCount, 1);
  });

  it("routes admin list", async () => {
    const ont = ontologyId("prod-router-admin");
    globalRegistry.register(ont, {}, entityId("ra-1"));
    const list = (await new ProductRouter().dispatchOntology(
      "admin-console",
      "list",
      ont,
    )) as unknown[];
    assert.equal(list.length, 1);
  });

  it("routes automations run with loop", async () => {
    const ont = ontologyId(`prod-router-auto-${Date.now()}`);
    const id = entityId("ra-auto-1");
    globalRegistry.register(ont, { status: "open" }, id);
    const result = (await new ProductRouter().dispatch({
      product: "automations",
      op: "run",
      session: session(),
      steps: [{ id: "s1", action: "notify" }],
      loop: { ontologyId: ont, entityId: id, patch: { status: "closed" } },
    })) as { workflowResults: string[]; loop?: { state: string } };
    assert.equal(result.workflowResults[0], "ok:s1:notify");
    assert.equal(result.loop?.state, "committed");
  });

  it("routes automations evaluate and approve", async () => {
    const ont = ontologyId(`prod-router-appr-${Date.now()}`);
    const id = entityId("ra-appr-1");
    globalRegistry.register(ont, { amount: 100 }, id);
    const router = new ProductRouter();
    const decision = (await router.dispatch({
      product: "automations",
      op: "evaluate",
      patch: { amount: 99_999 },
      approvals: [],
    })) as { requiresApproval: boolean };
    assert.equal(decision.requiresApproval, true);
    const outcome = (await router.dispatch({
      product: "automations",
      op: "approve",
      session: session(),
      loop: { ontologyId: ont, entityId: id, patch: { amount: 100, status: "ok" } },
      approvals: ["mgr-1"],
    })) as { state: string };
    assert.equal(outcome.state, "committed");
  });
});
