import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createGatewayTestApp, devApiKey } from "../helpers/gateway-test-app.js";

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    "content-type": "application/json",
    "x-api-key": devApiKey(),
    ...extra,
  };
}

describe("gateway security", () => {
  it("read and search require credentials", async () => {
    const { baseUrl, close } = await createGatewayTestApp({
      DAEMON_AUTH_MODE: "dev",
      DAEMON_INGEST_SKIP_UPSTREAM: "1",
    });
    try {
      const readDenied = await fetch(
        `${baseUrl}/v1/read/entities?ontologyId=foundation`,
      );
      assert.equal(readDenied.status, 401);

      const searchDenied = await fetch(`${baseUrl}/v1/search?q=test`);
      assert.equal(searchDenied.status, 401);

      const readOk = await fetch(
        `${baseUrl}/v1/read/entities?ontologyId=foundation`,
        { headers: authHeaders() },
      );
      assert.ok(readOk.status === 200 || readOk.status === 404);
    } finally {
      await close();
    }
  });

  it("rejects cross-tenant header spoof for session-backed routes", async () => {
    const { baseUrl, close } = await createGatewayTestApp({
      DAEMON_AUTH_MODE: "dev",
      DAEMON_INGEST_SKIP_UPSTREAM: "1",
    });
    try {
      const res = await fetch(
        `${baseUrl}/v1/read/entities?ontologyId=foundation`,
        {
          headers: authHeaders({
            "x-daemon-tenant": "ent-beta",
            "x-daemon-domain": "foundation",
          }),
        },
      );
      assert.equal(res.status, 403);
    } finally {
      await close();
    }
  });

  it("webhook ingest fails closed when HMAC required but secret unset", async () => {
    const { baseUrl, close } = await createGatewayTestApp({
      DAEMON_AUTH_MODE: "dev",
      DAEMON_INGEST_SKIP_UPSTREAM: "1",
      DAEMON_POLICY_MODE: "prod",
      DAEMON_WEBHOOK_HMAC_SECRET: undefined,
    });
    try {
      const res = await fetch(`${baseUrl}/v1/ingest/webhooks/demo-parties`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ontologyId: "foundation",
          entityId: "wh-1",
          entityType: "Party",
          properties: { displayName: "Webhook Party" },
        }),
      });
      assert.ok(res.status === 401 || res.status === 503);
    } finally {
      await close();
    }
  });

  it("policy probe requires authentication", async () => {
    const { baseUrl, close } = await createGatewayTestApp({
      DAEMON_AUTH_MODE: "dev",
    });
    try {
      const denied = await fetch(`${baseUrl}/v1/policy/check`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "read", resource: "entity" }),
      });
      assert.equal(denied.status, 401);
    } finally {
      await close();
    }
  });
});
