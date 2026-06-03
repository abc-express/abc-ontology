import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { globalRegistry } from "@daemon/ontology";
import { ontologyId, entityId } from "@daemon/platform-types";
import { ProductRuntime } from "../shared/product-runtime.js";
import { DashboardBuilder } from "./dashboard-builder.js";

describe("DashboardBuilder", () => {
  it("aggregates status counts", () => {
    const ont = ontologyId(`prod-dash-${Date.now()}`);
    globalRegistry.register(ont, { status: "active" }, entityId("d-1"));
    globalRegistry.register(ont, { status: "pending" }, entityId("d-2"));
    const spec = new DashboardBuilder(new ProductRuntime()).build(ont);
    assert.equal(spec.widgets.length, 4);
    const total = spec.widgets.find((w) => w.id === "entity-count")?.data as {
      total: number;
    };
    assert.equal(total.total, 2);
    const breakdown = spec.widgets.find((w) => w.id === "property-breakdown");
    assert.equal((breakdown?.data as { counts: Record<string, number> }).counts.active, 1);
    const recent = spec.widgets.find((w) => w.id === "recent-entities")?.data as {
      entityIds: string[];
    };
    assert.ok(recent.entityIds.includes(entityId("d-1")));
    assert.ok(recent.entityIds.includes(entityId("d-2")));
  });
});
