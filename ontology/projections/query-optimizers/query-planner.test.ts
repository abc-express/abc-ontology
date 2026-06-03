import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OntologyRegistry } from "../../registry/ontology-registry.js";
import { ontologyId } from "@daemon/platform-types";
import { EntityReadModelProjection } from "../read-models/entity-read-model.js";
import { QueryPlanner } from "./query-planner.js";

function setup() {
  const reg = new OntologyRegistry();
  const proj = new EntityReadModelProjection();
  proj.attach(reg);
  const planner = new QueryPlanner(proj);
  const ont = ontologyId("Order");
  return { reg, proj, planner, ont };
}

describe("QueryPlanner", () => {
  it("chooses point-lookup when entityId is provided", () => {
    const { reg, planner, ont } = setup();
    const e = reg.register(ont, { status: "open" });
    const result = planner.execute({
      ontologyId: String(ont),
      entityId: String(e.entityId),
    });
    assert.equal(result.plan.strategy, "point-lookup");
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].properties.status, "open");
  });

  it("chooses indexed-scan when equality filters are present", () => {
    const { reg, planner, ont } = setup();
    reg.register(ont, { status: "open" });
    reg.register(ont, { status: "closed" });
    const result = planner.execute({
      ontologyId: String(ont),
      equals: { status: "open" },
    });
    assert.equal(result.plan.strategy, "indexed-scan");
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].properties.status, "open");
  });

  it("chooses full-scan when no filters are present", () => {
    const { reg, planner, ont } = setup();
    reg.register(ont, { status: "open" });
    reg.register(ont, { status: "closed" });
    const result = planner.execute({ ontologyId: String(ont) });
    assert.equal(result.plan.strategy, "full-scan");
    assert.equal(result.rows.length, 2);
  });

  it("applies a limit to scan results", () => {
    const { reg, planner, ont } = setup();
    reg.register(ont, { status: "open" });
    reg.register(ont, { status: "open" });
    reg.register(ont, { status: "open" });
    const result = planner.execute({ ontologyId: String(ont), limit: 2 });
    assert.equal(result.rows.length, 2);
  });

  it("returns empty rows for a missing point lookup", () => {
    const { planner, ont } = setup();
    const result = planner.execute({
      ontologyId: String(ont),
      entityId: "ent-999",
    });
    assert.equal(result.plan.strategy, "point-lookup");
    assert.equal(result.rows.length, 0);
  });
});
