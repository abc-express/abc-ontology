import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildPackGraphSchema, isAllowedEntityLabel } from "./pack-graph-schema.js";

describe("pack-graph-schema", () => {
  it("builds schema from foundation pack", () => {
    const schema = buildPackGraphSchema();
    assert.equal(schema.ontologyId, "foundation");
    assert.ok(schema.entityTypes.includes("Party"));
    assert.ok(schema.entityTypes.includes("Case"));
    assert.ok(schema.promptSchemaSummary.includes("$tenantId"));
    assert.ok(schema.constraintStatements.length >= 1);
    const party = schema.entities.find((e) => e.entityType === "Party");
    assert.ok(party?.fields.some((f) => f.name === "displayName"));
  });

  it("validates entity labels", () => {
    assert.equal(isAllowedEntityLabel("Party"), true);
    assert.equal(isAllowedEntityLabel("NotReal"), false);
  });
});
