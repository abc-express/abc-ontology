/** Spec: collect-sensing/connectors/db-connectors/postgres-read-connector.ts */
import {
  type RawRecord,
  type SourceConnector,
  toRawRecords,
} from "../connector.js";

/**
 * Minimal query surface required to read records. The `PostgresClient` from
 * `@daemon/data-platform/operational-store` satisfies this shape, but any
 * adapter (including a test fake) that returns rows works here, keeping the
 * connector unit-testable without a live database.
 */
export interface QueryExecutor {
  query<T extends Record<string, unknown>>(
    sql: string,
    params?: ReadonlyArray<unknown>,
  ): Promise<T[]>;
}

export interface PostgresReadConnectorConfig {
  readonly sourceId: string;
  /** Parameterized SQL selecting the rows to ingest. */
  readonly sql: string;
  /** Bound parameters for the SQL statement. */
  readonly params?: ReadonlyArray<unknown>;
  /** Column used as the per-record id (defaults to "id" when present). */
  readonly recordIdColumn?: string;
}

/** Pulls rows from Postgres (or any {@link QueryExecutor}) as raw records. */
export class PostgresReadConnector implements SourceConnector {
  readonly kind = "db";
  readonly sourceId: string;

  constructor(
    private readonly executor: QueryExecutor,
    private readonly config: PostgresReadConnectorConfig,
  ) {
    if (!config.sql.trim()) {
      throw new Error("postgres-read-connector requires a non-empty sql");
    }
    this.sourceId = config.sourceId;
  }

  async fetch(): Promise<RawRecord[]> {
    const rows = await this.executor.query<Record<string, unknown>>(
      this.config.sql,
      this.config.params,
    );
    return toRawRecords(this.sourceId, rows, this.config.recordIdColumn ?? "id");
  }
}
