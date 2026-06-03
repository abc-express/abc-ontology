import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { globalRegistry } from "@daemon/ontology";
import { entityId, ontologyId } from "@daemon/platform-types";
import { createGatewayTestApp, DEV_API_KEY } from "../helpers/gateway-test-app.js";
import { startMockIngestServer } from "../helpers/mock-ingest-server.js";

const ONT = "e2e-http";
const ENT = "e2e-http-entity";

describe("e2e HTTP path", () => {
  it("ingest via gateway registers ontology then read/write", async (t) => {
    if (process.env.DAEMON_INTEGRATION_REQUIRED !== "1") {
      t.skip("set DAEMON_INTEGRATION_REQUIRED=1 to run HTTP e2e");
      return;
    }
    const ingest = await startMockIngestServer();
    const { baseUrl, close } = await createGatewayTestApp({
      DAEMON_INGEST_URL: ingest.baseUrl,
      DAEMON_AUTH_MODE: "dev",
    });
    const headers = {
      "content-type": "application/json",
      "x-api-key": DEV_API_KEY,
    };
    try {
      const ingestRes = await fetch(`${baseUrl}/v1/ingest/records`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          sourceId: "e2e",
          records: [{ ontologyId: ONT, entityId: ENT, properties: { status: "seed" } }],
        }),
      });
      assert.equal(ingestRes.status, 201);

      const readRes = await fetch(
        `${baseUrl}/v1/read/entities/${ENT}?ontologyId=${ONT}`,
      );
      assert.equal(readRes.status, 200);
      const readBody = (await readRes.json()) as { properties: { status: string } };
      assert.equal(readBody.properties.status, "seed");

      const writeRes = await fetch(`${baseUrl}/v1/write`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          ontologyId: ONT,
          entityId: ENT,
          patch: { status: "active" },
        }),
      });
      assert.equal(writeRes.status, 201);

      const record = globalRegistry.get(ontologyId(ONT), entityId(ENT));
      assert.equal(record?.properties.status, "active");
    } finally {
      await close();
      await ingest.close();
    }
  });
});
