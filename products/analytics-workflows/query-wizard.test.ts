import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { globalRegistry } from "@daemon/ontology";
import { ontologyId, entityId } from "@daemon/platform-types";
import { ProductRuntime } from "../shared/product-runtime.js";
import { QueryWizard } from "./query-wizard.js";

describe("QueryWizard", () => {
  it("finds entities by property substring", () => {
    const ont = ontologyId("prod-qw");
    globalRegistry.register(ont, { name: "Alpha Widget" }, entityId("qw-1"));
    globalRegistry.register(ont, { name: "Beta" }, entityId("qw-2"));
    const wizard = new QueryWizard(new ProductRuntime());
    const hits = wizard.search({ query: "alpha", ontologyId: ont });
    assert.equal(hits.length, 1);
    assert.equal(hits[0]?.entityId, entityId("qw-1"));
  });

  it("filters by property value", () => {
    const ont = ontologyId("prod-qw-filter");
    globalRegistry.register(ont, { status: "active", name: "One" }, entityId("f-1"));
    globalRegistry.register(ont, { status: "pending", name: "Two" }, entityId("f-2"));
    const wizard = new QueryWizard(new ProductRuntime());
    const hits = wizard.search({
      query: "one",
      ontologyId: ont,
      property: "status",
      propertyValue: "active",
    });
    assert.equal(hits.length, 1);
    assert.equal(hits[0]?.entityId, entityId("f-1"));
  });
});
