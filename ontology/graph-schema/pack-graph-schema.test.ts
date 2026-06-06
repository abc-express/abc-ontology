import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PackResolver } from "../packs/pack-resolver.js";
import { DomainCatalog } from "../tenancy/domain-catalog.js";
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

  it("builds schema from merged logistics-commercial pack", () => {
    const catalog = DomainCatalog.fromYamlFile();
    const resolver = new PackResolver(catalog);
    const tenant = {
      id: "logistics-pilot",
      displayName: "Logistics pilot",
      enabledDomains: ["logistics"],
    };
    const resolved = resolver.resolve(tenant, "logistics");
    const schema = buildPackGraphSchema(resolved);
    assert.equal(schema.ontologyId, "foundation");
    assert.ok(schema.entityTypes.includes("Shipment"));
    assert.ok(schema.entityTypes.includes("Account"));
    assert.ok(schema.entityTypes.includes("Lead"));
    assert.ok(schema.entityTypes.includes("Trip"));
    assert.ok(schema.entityTypes.includes("PickupRequest"));
    assert.ok(schema.entityTypes.includes("RegionalOffice"));
    assert.ok(schema.promptSchemaSummary.includes("Shipment"));
    const shipment = schema.entities.find((e) => e.entityType === "Shipment");
    assert.ok(shipment?.fields.some((f) => f.name === "status"));
    const ttk = schema.entities.find((e) => e.entityType === "TTK");
    assert.ok(ttk?.fields.some((f) => f.name === "chargeableWeight"));
  });
});
