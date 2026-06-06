import { readFileSync } from "node:fs";
import type { SourceConnector } from "./connector.js";
import { FileIngestConnector } from "./file-connectors/file-ingest-connector.js";
import {
  HttpPullConnector,
  type HttpFetch,
} from "./api-connectors/http-pull-connector.js";
import {
  PostgresReadConnector,
  type QueryExecutor,
} from "./db-connectors/postgres-read-connector.js";
import {
  EventSubscriberConnector,
  type EventSubscription,
} from "./event-connectors/event-subscriber-connector.js";
import { S3Connector } from "./file-connectors/s3-connector.js";
import { KafkaConsumerConnector } from "./event-connectors/kafka-consumer-connector.js";
import {
  JdbcCdcConnector,
  type CdcQueryExecutor,
} from "./db-connectors/jdbc-cdc-connector.js";
import type {
  IngestSourceDefinition,
  SourceConnectorConfig,
} from "../orchestrator/source-catalog.js";
import { resolveRepoPath } from "../paths.js";

export interface ConnectorFactoryOptions {
  readonly httpFetch?: HttpFetch;
  readonly queryExecutor?: QueryExecutor;
  readonly cdcQueryExecutor?: CdcQueryExecutor;
  readonly eventSubscription?: EventSubscription;
}

function buildConnector(
  sourceId: string,
  config: SourceConnectorConfig,
  options: ConnectorFactoryOptions,
): SourceConnector {
  switch (config.type) {
    case "file": {
      const absolute = resolveRepoPath(config.path);
      const content = readFileSync(absolute, "utf8");
      const connector = new FileIngestConnector({
        sourceId,
        format: config.format,
      });
      connector.stage(content);
      return connector;
    }
    case "http-pull": {
      if (!options.httpFetch) {
        throw new Error(
          `http-pull connector for source ${sourceId} requires httpFetch`,
        );
      }
      return new HttpPullConnector(options.httpFetch, {
        sourceId,
        url: config.url,
        headers: config.headers,
        recordIdKey: config.recordIdKey,
      });
    }
    case "postgres-read": {
      if (!options.queryExecutor) {
        throw new Error(
          `postgres-read connector for source ${sourceId} requires queryExecutor (set DAEMON_POSTGRES_URL or connector.connectionEnv)`,
        );
      }
      return new PostgresReadConnector(options.queryExecutor, {
        sourceId,
        sql: config.sql,
        params: config.params,
        recordIdColumn: config.recordIdColumn,
      });
    }
    case "event-subscriber": {
      if (!options.eventSubscription) {
        throw new Error(
          `event-subscriber connector for source ${sourceId} requires eventSubscription`,
        );
      }
      return new EventSubscriberConnector(options.eventSubscription, {
        sourceId,
        subject: config.subject,
        batchSize: config.batchSize,
        recordIdKey: config.recordIdKey,
        pullTimeoutMs: config.pullTimeoutMs,
      });
    }
    case "s3":
      return new S3Connector({
        sourceId,
        bucket: config.bucket,
        prefix: config.prefix,
        region: config.region,
        format: config.format,
        keys: config.keys,
        recordIdKey: config.recordIdKey,
        endpoint: config.endpoint,
      });
    case "kafka":
      return new KafkaConsumerConnector({
        sourceId,
        brokers: config.brokers,
        topic: config.topic,
        groupId: config.groupId,
        maxMessages: config.maxMessages,
        recordIdKey: config.recordIdKey,
      });
    case "jdbc-cdc": {
      if (!options.cdcQueryExecutor) {
        throw new Error(
          `jdbc-cdc connector for source ${sourceId} requires cdcQueryExecutor (set DAEMON_POSTGRES_URL)`,
        );
      }
      return new JdbcCdcConnector(options.cdcQueryExecutor, {
        sourceId,
        table: config.table,
        cursorColumn: config.cursorColumn,
        lastCursor: config.lastCursor,
        recordIdColumn: config.recordIdColumn,
      });
    }
    default: {
      const _exhaustive: never = config;
      throw new Error(`unsupported connector config: ${String(_exhaustive)}`);
    }
  }
}

export function createConnectorForSource(
  source: IngestSourceDefinition,
  options: ConnectorFactoryOptions = {},
): SourceConnector {
  return buildConnector(source.id, source.connector, options);
}
