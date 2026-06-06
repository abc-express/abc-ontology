import { Injectable } from "@nestjs/common";
import { DaemonError, ErrorCodes } from "@daemon/platform-types";
import {
  SourceCatalog,
  type SourceConnectorConfig,
} from "@daemon/collect-sensing/orchestrator/source-catalog";
import { createConnectorForSource } from "@daemon/collect-sensing/connectors/connector-factory";
import { QueryExecutorResolver } from "@daemon/collect-sensing/connectors/query-executor-resolver";
import { RecordNormalizer } from "@daemon/collect-sensing/normalization/record-normalizer";
import type { EntityPayload } from "@daemon/collect-sensing/normalization/record-normalizer";
import { StreamPipeline } from "@daemon/collect-sensing/pipelines/stream-pipeline";
import type { TenantContextHeaders } from "../platform/tenant-context";
import {
  IngestService,
  type IngestRecord,
  type IngestResult,
} from "./ingest.service";

@Injectable()
export class IngestPipelineService {
  private readonly catalog: SourceCatalog;
  private readonly stream = new StreamPipeline<IngestRecord>();
  private readonly queryExecutorResolver: QueryExecutorResolver;

  constructor(
    private readonly ingest: IngestService,
    env: NodeJS.ProcessEnv = process.env,
    queryExecutorResolver?: QueryExecutorResolver,
  ) {
    this.catalog = SourceCatalog.fromYamlFile();
    this.queryExecutorResolver =
      queryExecutorResolver ?? new QueryExecutorResolver(env);
    this.stream.on(async () => {
      /* hot-path hook — propagation subscribers register here in workers */
    });
  }

  static create(
    ingest: IngestService,
    env: NodeJS.ProcessEnv = process.env,
  ): IngestPipelineService {
    return new IngestPipelineService(ingest, env);
  }

  async runSource(
    ctx: TenantContextHeaders,
    sourceId: string,
  ): Promise<IngestResult> {
    const source = this.catalog.require(sourceId);
    const defaultConnectionString = process.env.DAEMON_POSTGRES_URL?.trim();
    const queryExecutor = await this.queryExecutorResolver.resolveForConnector(
      source.connector,
      defaultConnectionString,
    );
    const connector = createConnectorForSource(source, {
      queryExecutor,
      cdcQueryExecutor: queryExecutor
        ? async (sql, params) => queryExecutor.query(sql, params)
        : undefined,
      httpFetch: globalThis.fetch.bind(globalThis),
      eventSubscription: await this.resolveEventSubscription(source.connector),
    });
    const raw = await connector.fetch();
    const normalizer = new RecordNormalizer({
      ontologyId: source.normalize.ontologyId,
      entityType: source.normalize.entityType,
      mapping: source.normalize.mapping,
      idField: source.normalize.idField,
      meta: source.normalize.meta,
    });
    const payloads = normalizer.normalizeMany(raw);
    const records: IngestRecord[] = [];
    for (const payload of payloads) {
      const record = entityPayloadToIngestRecord(payload);
      await this.stream.emit(record);
      records.push(record);
    }
    if (records.length === 0) {
      throw new DaemonError(
        ErrorCodes.VALIDATION,
        `source ${sourceId} produced no records`,
        400,
      );
    }
    return this.ingest.persistIngestRecords(ctx, sourceId, records);
  }

  private async resolveEventSubscription(connector: SourceConnectorConfig) {
    if (connector.type !== "event-subscriber") return undefined;
    const natsUrl = process.env.DAEMON_NATS_URL ?? "nats://127.0.0.1:4222";
    const { createNatsSubscription } = await import(
      "@daemon/collect-sensing/connectors/event-connectors/nats-subscription"
    );
    return createNatsSubscription({
      servers: natsUrl,
      subject: connector.subject,
    });
  }
}

function entityPayloadToIngestRecord(payload: EntityPayload): IngestRecord {
  if (!payload.entityId) {
    throw new DaemonError(
      ErrorCodes.VALIDATION,
      "normalized record missing entityId",
      400,
    );
  }
  const entityType =
    payload.entityType ??
    (typeof payload.properties.entityType === "string"
      ? payload.properties.entityType
      : undefined);
  return {
    ontologyId: payload.ontologyId,
    entityId: payload.entityId,
    entityType,
    properties: payload.properties,
  };
}
