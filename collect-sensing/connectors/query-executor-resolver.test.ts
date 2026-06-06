import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { QueryExecutorResolver } from "./query-executor-resolver.js";

describe("QueryExecutorResolver", () => {
  it("uses connectionEnv for postgres-read upstream URL", () => {
    const resolver = new QueryExecutorResolver({
      DAEMON_POSTGRES_URL: "postgresql://daemon/journal",
      ANTERO_SUPABASE_DB_URL: "postgresql://antero/read",
    });
    const url = resolver.resolveConnectionString({
      type: "postgres-read",
      sql: "SELECT 1",
      connectionEnv: "ANTERO_SUPABASE_DB_URL",
    });
    assert.equal(url, "postgresql://antero/read");
  });

  it("falls back to DAEMON_POSTGRES_URL when connectionEnv is unset", () => {
    const resolver = new QueryExecutorResolver({
      DAEMON_POSTGRES_URL: "postgresql://daemon/journal",
    });
    const url = resolver.resolveConnectionString({
      type: "postgres-read",
      sql: "SELECT 1",
    });
    assert.equal(url, "postgresql://daemon/journal");
  });

  it("caches executors per connection string", async () => {
    const created: string[] = [];
    const resolver = new QueryExecutorResolver(
      { DAEMON_POSTGRES_URL: "postgresql://daemon/journal" },
      async (connectionString) => {
        created.push(connectionString);
        return { query: async () => [] };
      },
    );
    const connector = { type: "postgres-read" as const, sql: "SELECT 1" };
    const first = await resolver.resolveForConnector(connector);
    const second = await resolver.resolveForConnector(connector);
    assert.ok(first);
    assert.equal(first, second);
    assert.deepEqual(created, ["postgresql://daemon/journal"]);
  });
});
