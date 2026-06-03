import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OntologyRegistry } from "../../registry/ontology-registry.js";
import { ontologyId } from "@daemon/platform-types";
import { MaterializedView } from "./materialized-view.js";

describe("MaterializedView", () => {
  const byStatus = (props: Record<string, unknown>) =>
    String(props.status ?? "unknown");

  it("aggregates entities into buckets", () => {
    const reg = new OntologyRegistry();
    const view = new MaterializedView("orders-by-status", byStatus);
    view.attach(reg);

    const ont = ontologyId("Order");
    reg.register(ont, { status: "open" });
    reg.register(ont, { status: "open" });
    reg.register(ont, { status: "closed" });

    assert.equal(view.countFor("open"), 2);
    assert.equal(view.countFor("closed"), 1);
  });

  it("relocates an entity between buckets on patch", () => {
    const reg = new OntologyRegistry();
    const view = new MaterializedView("orders-by-status", byStatus);
    view.attach(reg);

    const ont = ontologyId("Order");
    const e = reg.register(ont, { status: "open" });
    assert.equal(view.countFor("open"), 1);

    reg.patch(ont, e.entityId, { status: "closed" });
    assert.equal(view.countFor("open"), 0);
    assert.equal(view.countFor("closed"), 1);
  });

  it("produces a snapshot sorted by descending count", () => {
    const reg = new OntologyRegistry();
    const view = new MaterializedView("orders-by-status", byStatus);
    view.attach(reg);

    const ont = ontologyId("Order");
    reg.register(ont, { status: "open" });
    reg.register(ont, { status: "open" });
    reg.register(ont, { status: "closed" });

    const snap = view.snapshot();
    assert.equal(snap[0].key, "open");
    assert.equal(snap[0].count, 2);
    assert.equal(snap[1].key, "closed");
  });

  it("defaults missing grouping field to unknown bucket", () => {
    const reg = new OntologyRegistry();
    const view = new MaterializedView("orders-by-status", byStatus);
    view.attach(reg);

    const ont = ontologyId("Order");
    reg.register(ont, { name: "no-status" });
    assert.equal(view.countFor("unknown"), 1);
  });
});
