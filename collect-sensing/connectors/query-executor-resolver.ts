/** Resolves Postgres {@link QueryExecutor} instances per connection string (cached). */
import type { QueryExecutor } from "./db-connectors/postgres-read-connector.js";
import type { SourceConnectorConfig } from "../orchestrator/source-catalog.js";

export type QueryExecutorFactory = (
  connectionString: string,
) => Promise<QueryExecutor> | QueryExecutor;

const defaultFactory: QueryExecutorFactory = async (connectionString) => {
  const { PostgresClient } = await import(
    "@daemon/data-platform/operational-store"
  );
  const client = new PostgresClient({ connectionString });
  return {
    query: async <T extends Record<string, unknown>>(
      sql: string,
      params?: ReadonlyArray<unknown>,
    ) => {
      const result = await client.query<T>(sql, params ?? []);
      return result.rows;
    },
  };
};

/**
 * Resolves which Postgres URL backs a connector and returns a cached executor.
 * `postgres-read` may set `connectionEnv` to read from an upstream system (e.g.
 * Antero Supabase); otherwise the default journal URL is used.
 */
export class QueryExecutorResolver {
  private readonly cache = new Map<string, QueryExecutor>();

  constructor(
    private readonly env: NodeJS.ProcessEnv = process.env,
    private readonly createExecutor: QueryExecutorFactory = defaultFactory,
  ) {}

  async resolveForConnector(
    connector: SourceConnectorConfig,
    defaultConnectionString?: string,
  ): Promise<QueryExecutor | undefined> {
    const url = this.resolveConnectionString(connector, defaultConnectionString);
    if (!url) {
      return undefined;
    }
    return this.getOrCreate(url);
  }

  resolveConnectionString(
    connector: SourceConnectorConfig,
    defaultConnectionString?: string,
  ): string | undefined {
    if (connector.type === "postgres-read") {
      const envName = connector.connectionEnv?.trim();
      if (envName) {
        const upstream = this.env[envName]?.trim();
        return upstream || undefined;
      }
      return defaultConnectionString?.trim() || this.env.DAEMON_POSTGRES_URL?.trim();
    }
    if (connector.type === "jdbc-cdc") {
      return defaultConnectionString?.trim() || this.env.DAEMON_POSTGRES_URL?.trim();
    }
    return defaultConnectionString?.trim() || this.env.DAEMON_POSTGRES_URL?.trim();
  }

  private async getOrCreate(connectionString: string): Promise<QueryExecutor> {
    const cached = this.cache.get(connectionString);
    if (cached) {
      return cached;
    }
    const executor = await this.createExecutor(connectionString);
    this.cache.set(connectionString, executor);
    return executor;
  }
}
