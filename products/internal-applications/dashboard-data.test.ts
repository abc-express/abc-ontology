import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { globalRegistry } from "@daemon/ontology";
import { ontologyId, entityId } from "@daemon/platform-types";
import { ProductRuntime } from "../shared/product-runtime.js";
import { DashboardDataService } from "./dashboard-data.js";

describe("DashboardDataService", () => {
  it("exposes ops metrics", () => {
    const ont = ontologyId("prod-ops");
    globalRegistry.register(ont, { status: "active" }, entityId("ops-1"));
    const snap = new DashboardDataService(new ProductRuntime()).snapshot(ont);
    assert.equal(snap.metrics.find((m) => m.name === "entities_total")?.value, 1);
    assert.ok(snap.recentEntityIds.includes(entityId("ops-1")));
  });
});
