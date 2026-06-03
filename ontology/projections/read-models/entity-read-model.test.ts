import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OntologyRegistry } from "../../registry/ontology-registry.js";
import { ontologyId } from "@daemon/platform-types";
import { EntityReadModelProjection } from "./entity-read-model.js";

describe("EntityReadModelProjection", () => {
  it("builds read models from registry events", () => {
    const reg = new OntologyRegistry();
    const proj = new EntityReadModelProjection();
    proj.attach(reg);

    const ont = ontologyId("Customer");
    const e = reg.register(ont, { name: "Acme" });
    const view = proj.get(String(ont), String(e.entityId));
    assert.ok(view);
    assert.equal(view?.properties.name, "Acme");
    assert.equal(view?.version, 1);
  });

  it("updates the read model on patch", () => {
    const reg = new OntologyRegistry();
    const proj = new EntityReadModelProjection();
    proj.attach(reg);

    const ont = ontologyId("Customer");
    const e = reg.register(ont, { name: "Acme" });
    reg.patch(ont, e.entityId, { name: "Acme Corp" });

    const view = proj.get(String(ont), String(e.entityId));
    assert.equal(view?.properties.name, "Acme Corp");
    assert.equal(view?.version, 2);
  });

  it("lists read models for an ontology sorted by entity id", () => {
    const reg = new OntologyRegistry();
    const proj = new EntityReadModelProjection();
    proj.attach(reg);

    const ont = ontologyId("Customer");
    reg.register(ont, { name: "B" });
    reg.register(ont, { name: "A" });
    const list = proj.list(String(ont));
    assert.equal(list.length, 2);
    assert.deepEqual(
      list.map((v) => v.entityId),
      ["ent-1", "ent-2"],
    );
  });

  it("stops receiving events after detach", () => {
    const reg = new OntologyRegistry();
    const proj = new EntityReadModelProjection();
    proj.attach(reg);
    proj.detach();

    const ont = ontologyId("Customer");
    reg.register(ont, { name: "Acme" });
    assert.equal(proj.size, 0);
  });
});
