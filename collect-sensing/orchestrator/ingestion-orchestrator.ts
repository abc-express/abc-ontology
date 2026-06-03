/** Spec: collect-sensing/orchestrator/ingestion-orchestrator.ts */
import type { SourceConnector } from "../connectors/connector.js";
import type { EntityPayload, RecordNormalizer } from "../normalization/record-normalizer.js";
import { BatchPipeline } from "../pipelines/batch-pipeline.js";

export interface JobResult {
  jobId: string;
  status: string;
}

export interface IngestResult extends JobResult {
  accepted: number;
}

/** Minimal HTTP transport so the facade can be unit-tested without a network. */
export type HttpPost = (
  url: string,
  body: unknown,
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown>; text(): Promise<string> }>;

const defaultPost: HttpPost = (url, body) =>
  fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

/**
 * Facade coordinating the Go ingest job API with TypeScript normalization.
 * Connector → {@link RecordNormalizer} → batch → `POST /ingest/records`.
 */
export class IngestionOrchestratorClient {
  constructor(
    private readonly baseUrl: string,
    private readonly post: HttpPost = defaultPost,
  ) {}

  async runJob(sourceId: string): Promise<JobResult> {
    const res = await this.post(`${this.baseUrl}/v1/jobs`, { sourceId });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<JobResult>;
  }

  /** Forward a batch of normalized payloads to the Go ingest endpoint. */
  async ingestRecords(sourceId: string, records: EntityPayload[]): Promise<IngestResult> {
    const res = await this.post(`${this.baseUrl}/ingest/records`, { sourceId, records });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<IngestResult>;
  }

  /**
   * Pull every available record from `connector`, normalize it, and ingest the
   * resulting payloads as a single batch.
   */
  async ingestFromConnector(
    connector: SourceConnector,
    normalizer: RecordNormalizer,
  ): Promise<IngestResult> {
    const raw = await connector.fetch();
    const pipeline = new BatchPipeline();
    const payloads: EntityPayload[] = [];
    await pipeline.process(raw, async (record) => {
      payloads.push(normalizer.normalize(record));
    });
    return this.ingestRecords(connector.sourceId, payloads);
  }
}
