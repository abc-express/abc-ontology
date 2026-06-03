import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { globalRegistry } from "@daemon/ontology";
import { ontologyId, entityId } from "@daemon/platform-types";
import { AnalyticsWorkflows } from "./analytics-workflows.js";

describe("AnalyticsWorkflows", () => {
  it("searchAndReport and buildDashboard compose modules", () => {
    const ont = ontologyId(`prod-aw-${Date.now()}`);
    globalRegistry.register(ont, { status: "live", label: "metric-a" }, entityId("aw-1"));
    const flows = new AnalyticsWorkflows();
    const report = flows.searchAndReport({
      query: "metric",
      ontologyId: ont,
      reportTitle: "Metrics",
    });
    assert.equal(report.title, "Metrics");
    assert.equal(report.rowCount, 1);
    const dash = flows.buildDashboard(ont, { breakdownField: "status" });
    assert.equal(dash.widgets.find((w) => w.id === "property-breakdown")?.data.field, "status");
  });
});
