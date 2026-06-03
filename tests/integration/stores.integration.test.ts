import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PostgresClient } from "@daemon/data-platform/operational-store";
import { RedisCacheClient } from "@daemon/data-platform/cache";

describe("integration stores", () => {
  it("postgres round-trip", async (t) => {
    const url = process.env.DAEMON_POSTGRES_URL;
    if (!url) {
      t.skip("DAEMON_POSTGRES_URL not set — start compose.dev.yaml");
      return;
    }
    const pg = new PostgresClient({ connectionString: url });
    try {
      const ping = await pg.ping();
      assert.equal(ping.ok, true);
    } finally {
      await pg.close();
    }
  });

  it("redis round-trip", async (t) => {
    const url = process.env.DAEMON_REDIS_URL;
    if (!url) {
      t.skip("DAEMON_REDIS_URL not set — start compose.dev.yaml");
      return;
    }
    const redis = new RedisCacheClient({ url });
    try {
      assert.equal(await redis.ping(), "PONG");
    } finally {
      await redis.close();
    }
  });
});
