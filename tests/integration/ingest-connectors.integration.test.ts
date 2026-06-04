import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createConnectorForSource } from "../../collect-sensing/connectors/connector-factory.js";
import type { IngestSourceDefinition } from "../../collect-sensing/orchestrator/source-catalog.js";

const runS3 = process.env.DAEMON_INTEGRATION_S3 === "1";
const runKafka = process.env.DAEMON_INTEGRATION_KAFKA === "1";

const baseNormalize = {
  ontologyId: "foundation",
  entityType: "Party",
  mapping: { partyId: "partyId", name: "name" },
  idField: "partyId",
} as const;

describe("ingest connectors (integration)", () => {
  it("factory registers s3 connector type", async () => {
    const source: IngestSourceDefinition = {
      id: "test-s3",
      enabled: true,
      connector: {
        type: "s3",
        bucket: "daemon-test",
        prefix: "ingest/",
        format: "jsonl",
        recordIdKey: "id",
      },
      normalize: { ...baseNormalize },
    };
    const connector = createConnectorForSource(source);
    assert.equal(connector.kind, "file");
    if (!runS3) return;
    const records = await connector.fetch();
    assert.ok(Array.isArray(records));
  });

  it("factory registers kafka connector type", async () => {
    const source: IngestSourceDefinition = {
      id: "test-kafka",
      enabled: true,
      connector: {
        type: "kafka",
        topic: "daemon.ingest",
        brokers: ["localhost:9092"],
        recordIdKey: "id",
      },
      normalize: { ...baseNormalize },
    };
    const connector = createConnectorForSource(source);
    assert.equal(connector.kind, "event");
    if (!runKafka) return;
    const records = await connector.fetch();
    assert.ok(Array.isArray(records));
  });
});
