import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { globalRegistry, defaultOntology } from "@daemon/ontology";
import { entityId } from "@daemon/platform-types";
import { ProductRuntime } from "../shared/product-runtime.js";
import { ReportGenerator } from "./report-generator.js";

describe("ReportGenerator", () => {
  it("builds report rows from records", () => {
    const record = globalRegistry.register(
      defaultOntology(),
      { sku: "X1" },
      entityId("rep-1"),
    );
    const report = new ReportGenerator(new ProductRuntime()).generate("SKU", [
      record,
    ]);
    assert.equal(report.rowCount, 1);
    assert.equal(report.rows[0]?.properties.sku, "X1");
    assert.deepEqual(report.columns, ["sku"]);
    const csv = new ReportGenerator(new ProductRuntime()).toCsv(report);
    assert.ok(csv.includes("entityId,ontologyId,version,sku"));
    assert.ok(csv.includes("X1"));
  });
});
