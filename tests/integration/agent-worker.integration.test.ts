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

describe("agent worker integration", () => {
  it("creates session and runs supervisor without OpenRouter", async () => {
    const { baseUrl, close } = await createGatewayTestApp({
      DAEMON_AUTH_MODE: "dev",
      DAEMON_INGEST_SKIP_UPSTREAM: "1",
      OPENROUTER_API_KEY: undefined,
      DAEMON_OPENROUTER_API_KEY: undefined,
    });
    try {
      const createRes = await fetch(`${baseUrl}/v1/agents/sessions`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ tools: ["search", "read_entity"] }),
      });
      assert.ok(createRes.status === 200 || createRes.status === 201);
      const session = (await createRes.json()) as { sessionId: string };
      assert.ok(session.sessionId);

      const runRes = await fetch(
        `${baseUrl}/v1/agents/sessions/${encodeURIComponent(session.sessionId)}/run`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ message: "hello from integration test" }),
        },
      );
      assert.ok(runRes.status === 200 || runRes.status === 201);
      const body = (await runRes.json()) as {
        message?: string;
        intent?: string;
      };
      assert.ok(body.message || body.intent);
    } finally {
      await close();
    }
  });
});
