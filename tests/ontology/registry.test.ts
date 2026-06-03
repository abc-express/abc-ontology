import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ontologyId, entityId } from "@daemon/platform-types";
import {
  OntologyRegistry,
  defaultOntology,
} from "../../ontology/registry/ontology-registry.js";
import { NamespaceManager } from "../../ontology/registry/namespace-manager.js";
import { VersionManager } from "../../ontology/registry/version-manager.js";
import { EntityReadModelProjection } from "../../ontology/projections/read-models/entity-read-model.js";

describe("ontology registry — entity lifecycle", () => {
  it("registers, reads, and patches an entity with version bumps", () => {
    const reg = new OntologyRegistry();
    const ont = ontologyId("catalog");
    const id = entityId("sku-1");

    const created = reg.register(ont, { name: "widget" }, id);
    assert.equal(created.version, 1);
    assert.equal(created.properties.name, "widget");

    const fetched = reg.get(ont, id);
    assert.equal(fetched?.properties.name, "widget");

    const patched = reg.patch(ont, id, { name: "widget", price: 10 });
    assert.equal(patched.version, 2);
    assert.equal(patched.properties.price, 10);
  });

  it("throws when patching a missing entity", () => {
    const reg = new OntologyRegistry();
    assert.throws(() =>
      reg.patch(defaultOntology(), entityId("ghost"), { x: 1 }),
    );
  });

  it("isolates entities across ontologies sharing an id", () => {
    const reg = new OntologyRegistry();
    const id = entityId("shared");
    reg.register(ontologyId("a"), { from: "a" }, id);
    reg.register(ontologyId("b"), { from: "b" }, id);
    assert.equal(reg.get(ontologyId("a"), id)?.properties.from, "a");
    assert.equal(reg.get(ontologyId("b"), id)?.properties.from, "b");
  });
});

describe("ontology registry — namespaces", () => {
  it("registers and resolves namespaces, rejecting duplicates and bad names", () => {
    const ns = new NamespaceManager();
    const created = ns.register("catalog", "team-data");
    assert.equal(created.owner, "team-data");
    assert.equal(ns.resolve("catalog").name, "catalog");
    assert.throws(() => ns.register("catalog", "other"));
    assert.throws(() => ns.register("Invalid Name", "team-data"));
    assert.throws(() => ns.resolve("missing"));
  });
});

describe("ontology registry — version manager", () => {
  it("computes semver bumps and keeps append-only history", () => {
    const vm = new VersionManager("1.2.3");
    assert.equal(vm.current(), "1.2.3");
    assert.equal(vm.bump("patch"), "1.2.4");
    assert.equal(vm.bump("minor"), "1.3.0");
    assert.equal(vm.bump("major"), "2.0.0");
    assert.deepEqual([...vm.versions()], ["1.2.3", "1.2.4", "1.3.0", "2.0.0"]);
  });
});

describe("ontology projections — read model refresh", () => {
  it("reflects register and patch events from the attached registry", () => {
    const reg = new OntologyRegistry();
    const projection = new EntityReadModelProjection();
    projection.attach(reg);

    const ont = ontologyId("catalog");
    const id = entityId("sku-9");
    reg.register(ont, { status: "draft" }, id);

    const initial = projection.get(String(ont), String(id));
    assert.equal(initial?.version, 1);
    assert.equal(initial?.properties.status, "draft");

    reg.patch(ont, id, { status: "published" });
    const refreshed = projection.get(String(ont), String(id));
    assert.equal(refreshed?.version, 2);
    assert.equal(refreshed?.properties.status, "published");

    assert.equal(projection.list(String(ont)).length, 1);

    projection.detach();
    reg.register(ont, { status: "draft" }, entityId("sku-10"));
    assert.equal(
      projection.get(String(ont), "sku-10"),
      undefined,
      "detached projection must not receive further events",
    );
  });
});
