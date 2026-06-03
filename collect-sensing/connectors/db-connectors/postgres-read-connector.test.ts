import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PostgresReadConnector,
  type QueryExecutor,
} from "./postgres-read-connector.js";

class FakeExecutor implements QueryExecutor {
  public calls: Array<{ sql: string; params?: ReadonlyArray<unknown> }> = [];
  constructor(private readonly rows: Array<Record<string, unknown>>) {}
  async query<T extends Record<string, unknown>>(
    sql: string,
    params?: ReadonlyArray<unknown>,
  ): Promise<T[]> {
    this.calls.push(params === undefined ? { sql } : { sql, params });
    return this.rows as T[];
  }
}

describe("PostgresReadConnector", () => {
  it("executes the configured sql/params and maps rows to raw records", async () => {
    const exec = new FakeExecutor([
      { id: 1, sku: "A" },
      { id: 2, sku: "B" },
    ]);
    const connector = new PostgresReadConnector(exec, {
      sourceId: "warehouse",
      sql: "SELECT id, sku FROM products WHERE active = $1",
      params: [true],
      recordIdColumn: "id",
    });

    assert.equal(connector.kind, "db");
    const records = await connector.fetch();

    assert.deepEqual(exec.calls, [
      { sql: "SELECT id, sku FROM products WHERE active = $1", params: [true] },
    ]);
    assert.equal(records.length, 2);
    assert.equal(records[0]?.sourceId, "warehouse");
    assert.equal(records[0]?.recordId, "1");
    assert.deepEqual(records[1]?.payload, { id: 2, sku: "B" });
  });

  it("rejects an empty sql statement", () => {
    const exec = new FakeExecutor([]);
    assert.throws(
      () => new PostgresReadConnector(exec, { sourceId: "x", sql: "  " }),
      /non-empty sql/,
    );
  });
});
