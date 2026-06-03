import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PostgresAuditLog } from "./postgres-audit-log.js";

describe("PostgresAuditLog", () => {
  it("fromEnv returns null without DAEMON_POSTGRES_URL", () => {
    assert.equal(PostgresAuditLog.fromEnv({}), null);
  });
});
