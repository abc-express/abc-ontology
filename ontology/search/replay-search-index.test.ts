import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { entityId, ontologyId } from "@daemon/platform-types";
import type { EntityJournal } from "@daemon/data-platform/operational-store/entity-journal";
import type { EntityRecord } from "@daemon/context-ports";
import { ScopedOntologySearch } from "./scoped-ontology-search.js";
import { replaySearchIndex } from "./replay-search-index.js";

function record(eid: string, name: string): EntityRecord {
  return {
    tenantId: "t1",
    domainId: "foundation",
    ontologyId: ontologyId("foundation"),
    entityId: entityId(eid),
    entityType: "Party",
    properties: { displayName: name },
    version: 1,
    updatedAt: new Date().toISOString(),
  };
}

class MemoryJournal implements EntityJournal {
  constructor(private readonly rows: EntityRecord[]) {}

  async upsert(): Promise<void> {}
  async recordChange(): Promise<void> {}
  async upsertGraphEdge(): Promise<void> {}
  async loadAll(): Promise<EntityRecord[]> {
    return [...this.rows];
  }
  async loadScope(): Promise<EntityRecord[]> {
    return [...this.rows];
  }
  async close(): Promise<void> {}
}

describe("replaySearchIndex", () => {
  it("rebuilds search hits from journal without re-ingest", async () => {
    const scope = { tenantId: "t1", domainId: "foundation" };
    const rows = [
      record("r1", "ReplayAlpha Widget"),
      record("r2", "ReplayBeta Corp"),
    ];
    const indexed = new ScopedOntologySearch();
    for (const row of rows) {
      await indexed.indexAsync(row, scope);
    }
    const hitsBefore = await indexed.search(scope, {
      query: "ReplayAlpha",
      limit: 5,
    });
    assert.ok(hitsBefore.some((h) => h.entityId === "r1"));

    const fresh = new ScopedOntologySearch();
    const count = await replaySearchIndex(fresh, new MemoryJournal(rows));
    assert.equal(count, 2);

    const hitsAfter = await fresh.search(scope, {
      query: "ReplayAlpha",
      limit: 5,
    });
    assert.ok(hitsAfter.some((h) => h.entityId === "r1"));
  });
});
