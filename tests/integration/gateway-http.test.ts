import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createGatewayTestApp, DEV_API_KEY } from "../helpers/gateway-test-app.js";
import { startMockIngestServer } from "../helpers/mock-ingest-server.js";

describe("gateway HTTP", () => {
  it("health is open without credentials", async () => {
    const { baseUrl, close } = await createGatewayTestApp();
    try {
      const res = await fetch(`${baseUrl}/health`);
      assert.equal(res.status, 200);
    } finally {
      await close();
    }
  });

  it("protected ingest requires api key", async () => {
    const ingest = await startMockIngestServer();
    const { baseUrl, close } = await createGatewayTestApp({
      DAEMON_INGEST_URL: ingest.baseUrl,
      DAEMON_AUTH_MODE: "dev",
    });
    try {
      const denied = await fetch(`${baseUrl}/v1/ingest/records`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceId: "s1", records: [] }),
      });
      assert.equal(denied.status, 401);

      const ok = await fetch(`${baseUrl}/v1/ingest/records`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": DEV_API_KEY,
        },
        body: JSON.stringify({
          sourceId: "s1",
          records: [{ ontologyId: "http-ingest", entityId: "ent-http-1", properties: { n: 1 } }],
        }),
      });
      assert.equal(ok.status, 201);
    } finally {
      await close();
      await ingest.close();
    }
  });
});
