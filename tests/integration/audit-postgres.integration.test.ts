import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PostgresAuditLog } from "../../security-governance/audit/postgres-audit-log.js";

describe("integration postgres audit", () => {
  it("append and list audit rows", async (t) => {
    const url = process.env.DAEMON_POSTGRES_URL;
    if (!url) {
      t.skip("DAEMON_POSTGRES_URL not set — start compose.dev.yaml");
      return;
    }
    const log = PostgresAuditLog.fromEnv({ DAEMON_POSTGRES_URL: url });
    assert.ok(log);
    try {
      const entry = await log!.append({
        action: "test",
        subjectId: "integration",
        resource: "audit:integration",
        outcome: "allow",
      });
      assert.match(entry.id, /^audit-/);
      const rows = await log!.list(5);
      assert.ok(rows.some((r) => r.resource === "audit:integration"));
    } finally {
      await log!.close();
    }
  });
});
