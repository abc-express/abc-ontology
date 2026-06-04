import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { entityId, ontologyId } from "@daemon/platform-types";
import { ScopedOntologySearch } from "./scoped-ontology-search.js";
import type { EntityRecord } from "@daemon/context-ports";

function record(
  tenantId: string,
  domainId: string,
  ont: string,
  eid: string,
  name: string,
): EntityRecord {
  return {
    tenantId,
    domainId,
    ontologyId: ontologyId(ont),
    entityId: entityId(eid),
    entityType: "Party",
    properties: { displayName: name },
    version: 1,
    updatedAt: new Date().toISOString(),
  };
}

describe("ScopedOntologySearch", () => {
  it("indexes and returns scoped hybrid hits", async () => {
    const search = new ScopedOntologySearch();
    const scope = { tenantId: "t1", domainId: "foundation" };
    await search.indexAsync(
      record("t1", "foundation", "foundation", "p1", "Acme Logistics"),
      scope,
    );
    await search.indexAsync(
      record("t1", "foundation", "foundation", "p2", "Beta Corp"),
      scope,
    );
    await search.indexAsync(
      record("t2", "foundation", "foundation", "p3", "Acme Other"),
      { tenantId: "t2", domainId: "foundation" },
    );

    const hits = await search.search(scope, {
      query: "Acme Logistics",
      limit: 5,
      ontologyId: ontologyId("foundation"),
    });
    assert.ok(hits.length >= 1);
    assert.equal(hits[0]?.entityId, "p1");
    assert.ok(hits[0]!.score > 0);
  });
});
