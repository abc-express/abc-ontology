import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { globalRegistry } from "@daemon/ontology";
import {
  ontologyId,
  entityId,
  type DaemonSession,
  type SessionId,
} from "@daemon/platform-types";
import { ProductRuntime } from "../shared/product-runtime.js";
import { TaskOrchestrator } from "./task-orchestrator.js";

function session(): DaemonSession {
  return {
    sessionId: "sess-auto" as SessionId,
    subjectId: "ops",
    tenantId: "default",
    roles: ["operator"],
    issuedAt: new Date().toISOString(),
  };
}

describe("TaskOrchestrator", () => {
  it("runs workflow then loop write", async () => {
    const ont = ontologyId("prod-auto");
    const id = entityId("auto-1");
    globalRegistry.register(ont, { status: "open" }, id);
    const result = await new TaskOrchestrator(new ProductRuntime()).run(
      [{ id: "s1", action: "notify" }],
      {
        session: session(),
        ontologyId: ont,
        entityId: id,
        patch: { status: "closed" },
      },
    );
    assert.equal(result.workflowResults[0], "ok:s1:notify");
    assert.equal(result.loop?.state, "committed");
    assert.equal(globalRegistry.get(ont, id)?.properties.status, "closed");
  });
});
