import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createConnectorForSource } from "../../collect-sensing/connectors/connector-factory.js";
import type { IngestSourceDefinition } from "../../collect-sensing/orchestrator/source-catalog.js";
import { RecordNormalizer } from "../../collect-sensing/normalization/record-normalizer.js";

async function startPartiesHttpServer(): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  const server: Server = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify([
        { partyId: "http-pull-1", name: "HTTP Pull Party" },
      ]),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

describe("integration http-pull connector", () => {
  it("fetches JSON array via httpFetch and normalizes to Party payloads", async () => {
    const http = await startPartiesHttpServer();
    try {
      const source: IngestSourceDefinition = {
        id: "test-http-pull",
        enabled: true,
        connector: {
          type: "http-pull",
          url: `${http.baseUrl}/parties`,
        },
        normalize: {
          ontologyId: "foundation",
          entityType: "Party",
          mapping: { partyId: "partyId", name: "displayName" },
          idField: "partyId",
        },
      };
      const connector = createConnectorForSource(source, {
        httpFetch: globalThis.fetch.bind(globalThis),
      });
      const raw = await connector.fetch();
      assert.equal(raw.length, 1);
      const normalizer = new RecordNormalizer({
        ontologyId: source.normalize.ontologyId,
        entityType: source.normalize.entityType,
        mapping: source.normalize.mapping,
        idField: source.normalize.idField,
      });
      const payloads = normalizer.normalizeMany(raw);
      assert.equal(payloads[0]?.entityId, "http-pull-1");
      assert.equal(payloads[0]?.properties.displayName, "HTTP Pull Party");
    } finally {
      await http.close();
    }
  });
});
