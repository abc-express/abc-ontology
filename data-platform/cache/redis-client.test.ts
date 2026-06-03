import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RedisCacheClient } from "./redis-client.js";

describe("RedisCacheClient", () => {
  it("pings when DAEMON_REDIS_URL is set", async (t) => {
    const url = process.env.DAEMON_REDIS_URL;
    if (!url) {
      t.skip("DAEMON_REDIS_URL not set");
      return;
    }
    const client = new RedisCacheClient({ url });
    try {
      assert.equal(await client.ping(), "PONG");
    } finally {
      await client.close();
    }
  });
});
