import {
  type RawRecord,
  type SourceConnector,
  toRawRecords,
} from "../connector.js";

export interface JdbcCdcConnectorConfig {
  readonly sourceId: string;
  readonly table: string;
  readonly cursorColumn: string;
  readonly lastCursor?: string;
  readonly recordIdColumn?: string;
}

export type CdcQueryExecutor = (
  sql: string,
  params: unknown[],
) => Promise<Record<string, unknown>[]>;

/**
 * Polling CDC-style connector: reads rows where cursor > lastCursor.
 * Production Debezium wiring can replace the executor; gateway supplies SQL via Postgres.
 */
export class JdbcCdcConnector implements SourceConnector {
  readonly kind = "jdbc-cdc";
  readonly sourceId: string;

  constructor(
    private readonly query: CdcQueryExecutor,
    private readonly config: JdbcCdcConnectorConfig,
  ) {
    this.sourceId = config.sourceId;
  }

  async fetch(): Promise<RawRecord[]> {
    const cursor = this.config.lastCursor ?? "";
    const sql = `SELECT * FROM ${this.config.table} WHERE ${this.config.cursorColumn} > $1 ORDER BY ${this.config.cursorColumn} ASC LIMIT 500`;
    const rows = await this.query(sql, [cursor]);
    return toRawRecords(
      this.sourceId,
      rows,
      this.config.recordIdColumn ?? this.config.cursorColumn,
    );
  }
}
