import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { entityId, ontologyId } from "@daemon/platform-types";
import type { EntityRecord } from "@daemon/ontology";
import { ResponseAssembler } from "./response-assembler.js";

const record: EntityRecord = {
  entityId: entityId("e1"),
  ontologyId: ontologyId("o1"),
  properties: { a: 1, b: 2, c: 3 },
  version: 4,
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("ResponseAssembler", () => {
  const assembler = new ResponseAssembler();

  it("returns a full response when no projection is given", () => {
    const res = assembler.assemble(record);
    assert.equal(res.partial, false);
    assert.deepEqual(res.properties, { a: 1, b: 2, c: 3 });
    assert.equal(res.version, 4);
  });

  it("projects only requested fields and marks the response partial", () => {
    const res = assembler.assemble(record, ["a", "missing"]);
    assert.equal(res.partial, true);
    assert.deepEqual(res.properties, { a: 1 });
  });
});
