import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DaemonClient } from "./client.js";

describe("DaemonClient", () => {
  it("calls health endpoint", async () => {
    const client = new DaemonClient({
      baseUrl: "http://example.test",
      fetch: async () =>
        new Response(JSON.stringify({ status: "ok" }), { status: 200 }),
    });
    const h = await client.health();
    assert.deepEqual(h, { status: "ok" });
  });
});
