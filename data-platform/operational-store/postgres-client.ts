import pg from "pg";

export type PostgresConfig = {
  connectionString: string;
  maxPoolSize?: number;
};

export class PostgresClient {
  private readonly pool: pg.Pool;

  constructor(config: PostgresConfig) {
    this.pool = new pg.Pool({
      connectionString: config.connectionString,
      max: config.maxPoolSize ?? 10,
    });
  }

  async ping(): Promise<{ ok: true; serverTime: string }> {
    const result = await this.pool.query<{ now: Date }>("SELECT NOW() AS now");
    const row = result.rows[0];
    if (!row?.now) {
      throw new Error("postgres ping returned no row");
    }
    return { ok: true, serverTime: row.now.toISOString() };
  }

  async query<T extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params: readonly unknown[] = [],
  ): Promise<pg.QueryResult<T>> {
    return this.pool.query<T>(text, params as unknown[]);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
