import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AuditLog } from "./audit-log.js";

describe("AuditLog", () => {
  it("appends and lists entries", () => {
    const log = new AuditLog();
    log.append({
      action: "entity.read",
      subjectId: "u1",
      resource: "entity/e2e-1",
      outcome: "allow",
    });
    assert.equal(log.list().length, 1);
  });
});
