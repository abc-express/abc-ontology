import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createGatewayTestApp, DEV_API_KEY } from "../helpers/gateway-test-app.js";

const postgresUrl = process.env.DAEMON_POSTGRES_URL;

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    "content-type": "application/json",
    "x-api-key": DEV_API_KEY,
    ...extra,
  };
}

describe("DSDK production smoke (gateway surfaces)", () => {
  it("data-health, pack-resolution, lakehouse export, pipeline and eval stubs", async (t) => {
    if (!postgresUrl) {
      t.skip("DAEMON_POSTGRES_URL required");
      return;
    }
    const { baseUrl, close } = await createGatewayTestApp({
      DAEMON_POSTGRES_URL: postgresUrl,
      DAEMON_INGEST_SKIP_UPSTREAM: "1",
      DAEMON_AUTH_MODE: "dev",
    });
    try {
      const health = await fetch(`${baseUrl}/health`);
      assert.equal(health.status, 200);

      const ingestRes = await fetch(`${baseUrl}/v1/ingest/records`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          sourceId: "smoke-src",
          records: [
            {
              ontologyId: "foundation",
              entityId: "smoke-ent-1",
              entityType: "Party",
              properties: { displayName: "Smoke Party", entityType: "Party" },
            },
          ],
        }),
      });
      assert.ok(ingestRes.status === 201 || ingestRes.status === 200);

      const dh = await fetch(`${baseUrl}/v1/data-health/summary`, {
        headers: authHeaders(),
      });
      assert.equal(dh.status, 200);

      const pack = await fetch(`${baseUrl}/v1/ontology/pack-resolution?packBranch=main`, {
        headers: authHeaders(),
      });
      assert.equal(pack.status, 200);
      const packBody = (await pack.json()) as { packId?: string };
      assert.ok(packBody.packId);

      const exportStart = await fetch(`${baseUrl}/v1/lakehouse/export`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ limit: 10, format: "jsonl" }),
      });
      assert.ok(exportStart.status >= 200 && exportStart.status < 300);

      const pipeline = await fetch(`${baseUrl}/v1/pipelines/smoke/run`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          dag: {
            nodes: [{ id: "n1", type: "source", config: { sourceId: "smoke-src" } }],
          },
        }),
      });
      assert.ok(pipeline.status >= 200 && pipeline.status < 300);

      const evalRun = await fetch(`${baseUrl}/v1/evals/run`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          suite: {
            id: "smoke",
            cases: [{ id: "c1", question: "test", expectContains: [] }],
          },
        }),
      });
      assert.ok(evalRun.status >= 200 && evalRun.status < 300);

      const schedules = await fetch(`${baseUrl}/v1/ingest/schedules`, {
        headers: authHeaders(),
      });
      assert.equal(schedules.status, 200);
    } finally {
      await close();
    }
  });
});
