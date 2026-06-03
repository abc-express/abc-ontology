import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { WorkflowOrchestrator } from "./workflow-orchestrator.js";

describe("WorkflowOrchestrator", () => {
  it("runs steps in order", async () => {
    const orch = new WorkflowOrchestrator();
    const out = await orch.run([
      { id: "1", action: "read" },
      { id: "2", action: "write" },
    ]);
    assert.deepEqual(out, ["ok:1:read", "ok:2:write"]);
  });
});
