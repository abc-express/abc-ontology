import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OntologyRegistry } from "./ontology-registry.js";
import { ontologyId } from "@daemon/platform-types";

describe("OntologyRegistry", () => {
  it("registers and patches entities", () => {
    const reg = new OntologyRegistry();
    const ont = ontologyId("Customer");
    const e = reg.register(ont, { name: "Acme" });
    const updated = reg.patch(ont, e.entityId, { name: "Acme Corp" });
    assert.equal(updated.version, 2);
    assert.equal(updated.properties.name, "Acme Corp");
  });
});
