import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PostgresClient } from "./postgres-client.js";

describe("PostgresClient", () => {
  it("pings when DAEMON_POSTGRES_URL is set", async (t) => {
    const url = process.env.DAEMON_POSTGRES_URL;
    if (!url) {
      t.skip("DAEMON_POSTGRES_URL not set");
      return;
    }
    const client = new PostgresClient({ connectionString: url });
    try {
      const result = await client.ping();
      assert.equal(result.ok, true);
      assert.ok(result.serverTime);
    } finally {
      await client.close();
    }
  });
});
