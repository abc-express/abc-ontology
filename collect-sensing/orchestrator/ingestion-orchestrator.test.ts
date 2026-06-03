import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { IngestionOrchestratorClient, type HttpPost } from "./ingestion-orchestrator.js";
import { RecordNormalizer } from "../normalization/record-normalizer.js";
import type { RawRecord, SourceConnector } from "../connectors/connector.js";

function fakePost(
  capture: { url?: string; body?: unknown },
  response: unknown,
  ok = true,
): HttpPost {
  return async (url, body) => {
    capture.url = url;
    capture.body = body;
    return {
      ok,
      status: ok ? 200 : 500,
      json: async () => response,
      text: async () => JSON.stringify(response),
    };
  };
}

class StubConnector implements SourceConnector {
  readonly kind = "stub";
  constructor(
    readonly sourceId: string,
    private readonly rows: RawRecord[],
  ) {}
  async fetch(): Promise<RawRecord[]> {
    return this.rows;
  }
}

describe("IngestionOrchestratorClient", () => {
  it("runJob posts the sourceId to the job endpoint", async () => {
    const cap: { url?: string; body?: unknown } = {};
    const client = new IngestionOrchestratorClient(
      "http://x",
      fakePost(cap, { jobId: "job-1", status: "running" }),
    );
    const job = await client.runJob("crm-main");
    assert.equal(cap.url, "http://x/v1/jobs");
    assert.deepEqual(cap.body, { sourceId: "crm-main" });
    assert.equal(job.jobId, "job-1");
  });

  it("ingestRecords posts the batch to /ingest/records", async () => {
    const cap: { url?: string; body?: unknown } = {};
    const client = new IngestionOrchestratorClient(
      "http://x",
      fakePost(cap, { jobId: "job-2", status: "completed", accepted: 1 }),
    );
    const result = await client.ingestRecords("crm-main", [
      { ontologyId: "crm.contact", entityId: "c-1", properties: { name: "Ada" } },
    ]);
    assert.equal(cap.url, "http://x/ingest/records");
    assert.equal(result.accepted, 1);
  });

  it("ingestFromConnector normalizes then ingests in one batch", async () => {
    const cap: { url?: string; body?: unknown } = {};
    const client = new IngestionOrchestratorClient(
      "http://x",
      fakePost(cap, { jobId: "job-3", status: "completed", accepted: 2 }),
    );
    const connector = new StubConnector("crm-main", [
      { sourceId: "crm-main", recordId: "1", payload: { contact_id: "1", full_name: "Ada" } },
      { sourceId: "crm-main", recordId: "2", payload: { contact_id: "2", full_name: "Lin" } },
    ]);
    const normalizer = new RecordNormalizer({
      ontologyId: "crm.contact",
      mapping: { contact_id: "id", full_name: "name" },
      idField: "id",
    });

    const result = await client.ingestFromConnector(connector, normalizer);

    assert.equal(result.accepted, 2);
    const body = cap.body as { sourceId: string; records: unknown[] };
    assert.equal(body.sourceId, "crm-main");
    assert.equal(body.records.length, 2);
  });

  it("throws on non-ok responses", async () => {
    const cap: { url?: string; body?: unknown } = {};
    const client = new IngestionOrchestratorClient("http://x", fakePost(cap, { error: "boom" }, false));
    await assert.rejects(() => client.runJob("s"));
  });
});
