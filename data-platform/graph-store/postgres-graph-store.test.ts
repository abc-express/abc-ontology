import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PostgresGraphStore } from "./postgres-graph-store.js";

describe("PostgresGraphStore", () => {
  it("fromEnv returns null without postgres url", () => {
    assert.equal(PostgresGraphStore.fromEnv({}), null);
  });
});
