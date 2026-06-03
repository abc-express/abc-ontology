import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { IngestService, type IngestRecord } from "./ingest.service";
import { Protected } from "../auth/protected.decorator";
import { PolicyCheck } from "../auth/policy-check.decorator";

interface StartJobBody {
  sourceId: string;
}

interface IngestRecordsBody {
  sourceId?: string;
  records?: IngestRecord[];
  /** Convenience: single record without wrapping in `records[]`. */
  ontologyId?: string;
  entityId?: string;
  properties?: Record<string, unknown>;
  payload?: Record<string, unknown>;
}

function normalizeIngestRecords(body: IngestRecordsBody): IngestRecord[] {
  if (body.records?.length) {
    return body.records;
  }
  if (body.ontologyId) {
    return [
      {
        ontologyId: body.ontologyId,
        entityId: body.entityId,
        properties: body.properties ?? body.payload ?? {},
      },
    ];
  }
  return [];
}

/**
 * Gateway surface for the ingest pipeline. Job creation and record ingestion
 * are write-side operations and therefore {@link Protected}; reading job status
 * is allowed for any authenticated caller.
 */
@Controller("v1/ingest")
export class IngestController {
  constructor(private readonly ingest: IngestService) {}

  @Post("jobs")
  @Protected()
  @PolicyCheck("ingest", "ingest-job")
  startJob(@Body() body: StartJobBody) {
    return this.ingest.startJob(body.sourceId);
  }

  @Get("jobs/:id")
  getJob(@Param("id") id: string) {
    return this.ingest.getJob(id);
  }

  @Post("records")
  @Protected()
  @PolicyCheck("ingest", "ingest-record")
  ingestRecords(@Body() body: IngestRecordsBody) {
    const records = normalizeIngestRecords(body);
    return this.ingest.ingestRecords(body.sourceId ?? "gateway", records);
  }
}
