import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ExternalWriteGuard } from "./external-write-guard.js";

const policy = {
  allowedSystems: ["salesforce"],
  approvalRequired: ["delete"],
  maxAutoRecords: 100,
};

describe("ExternalWriteGuard", () => {
  const guard = new ExternalWriteGuard(policy);

  it("denies unknown systems", () => {
    const d = guard.evaluate({ system: "sap", operation: "create", recordCount: 1 });
    assert.equal(d.effect, "deny");
  });

  it("requires approval for destructive operations", () => {
    const d = guard.evaluate({ system: "salesforce", operation: "delete", recordCount: 1 });
    assert.equal(d.effect, "deny");
    assert.deepEqual(d.obligations, ["human-approval"]);
    const ok = guard.evaluate(
      { system: "salesforce", operation: "delete", recordCount: 1 },
      true,
    );
    assert.equal(ok.effect, "allow");
  });

  it("requires approval for oversized batches", () => {
    const d = guard.evaluate({ system: "salesforce", operation: "update", recordCount: 250 });
    assert.equal(d.effect, "deny");
  });

  it("allows small in-policy writes", () => {
    const d = guard.evaluate({ system: "salesforce", operation: "update", recordCount: 5 });
    assert.equal(d.effect, "allow");
  });
});
