import { Injectable } from "@nestjs/common";
import { globalRegistry } from "@daemon/ontology";
import { DaemonError, ErrorCodes, entityId, ontologyId } from "@daemon/platform-types";

export interface JobResult {
  jobId: string;
  status: string;
  sourceId?: string;
  startedAt?: string;
}

export interface IngestResult extends JobResult {
  accepted?: number;
}

export interface IngestRecord {
  ontologyId: string;
  entityId?: string;
  properties: Record<string, unknown>;
}

/**
 * Thin HTTP proxy onto the Go ingest orchestrator. The base URL is taken from
 * `DAEMON_INGEST_URL` (default `http://127.0.0.1:8081`). All upstream failures
 * are surfaced as {@link DaemonError} with an `UPSTREAM` code so the gateway
 * returns a consistent error envelope.
 */
@Injectable()
export class IngestService {
  private readonly baseUrl: string;
  private readonly skipUpstream: boolean;

  constructor(env: NodeJS.ProcessEnv) {
    this.baseUrl = (env.DAEMON_INGEST_URL ?? "http://127.0.0.1:8081").replace(/\/+$/, "");
    this.skipUpstream =
      env.DAEMON_INGEST_SKIP_UPSTREAM === "1" ||
      env.DAEMON_INGEST_SKIP_UPSTREAM === "true";
  }

  /** Nest and tests should use this; avoids DI on `process.env`. */
  static create(env: NodeJS.ProcessEnv = process.env): IngestService {
    return new IngestService(env);
  }

  /** Start an ingest job for `sourceId`. */
  async startJob(sourceId: string): Promise<JobResult> {
    return this.post<JobResult>("/v1/jobs", { sourceId });
  }

  /** Fetch a previously started job by id. */
  async getJob(jobId: string): Promise<JobResult> {
    const res = await fetch(`${this.baseUrl}/v1/jobs/${encodeURIComponent(jobId)}`);
    if (res.status === 404) {
      throw new DaemonError(ErrorCodes.NOT_FOUND, `ingest job ${jobId} not found`, 404);
    }
    if (!res.ok) {
      throw new DaemonError(ErrorCodes.UPSTREAM, await safeText(res), 502);
    }
    return (await res.json()) as JobResult;
  }

  /** Forward a batch of normalized records to the orchestrator. */
  async ingestRecords(sourceId: string, records: IngestRecord[]): Promise<IngestResult> {
    if (records.length === 0) {
      throw new DaemonError(ErrorCodes.VALIDATION, "records must not be empty", 400);
    }
    this.registerOntologyRecords(records);
    if (this.skipUpstream) {
      return {
        jobId: `local-${sourceId}`,
        status: "accepted",
        sourceId,
        accepted: records.length,
      };
    }
    return this.post<IngestResult>("/ingest/records", { sourceId, records });
  }

  private registerOntologyRecords(records: IngestRecord[]): void {
    let seq = 0;
    for (const record of records) {
      if (!record.ontologyId) continue;
      seq += 1;
      const ent =
        record.entityId ?? `${record.ontologyId}-ingest-${Date.now()}-${seq}`;
      globalRegistry.register(
        ontologyId(record.ontologyId),
        record.properties ?? {},
        entityId(ent),
      );
    }
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw new DaemonError(
        ErrorCodes.UPSTREAM,
        `ingest service unreachable: ${(error as Error).message}`,
        502,
      );
    }
    if (!res.ok) {
      throw new DaemonError(ErrorCodes.UPSTREAM, await safeText(res), 502);
    }
    return (await res.json()) as T;
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text || `ingest service responded ${res.status}`;
  } catch {
    return `ingest service responded ${res.status}`;
  }
}
