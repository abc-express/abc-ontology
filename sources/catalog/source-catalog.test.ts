import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SourceCatalog } from "./source-catalog.js";

describe("SourceCatalog", () => {
  it("registers and validates manifests", () => {
    const catalog = new SourceCatalog();
    const manifest = {
      id: "crm",
      type: "api" as const,
      ontologyId: "crm",
      config: { baseUrl: "https://example" },
    };
    assert.deepEqual(catalog.validate(manifest), []);
    catalog.register(manifest);
    assert.equal(catalog.get("crm")?.ontologyId, "crm");
  });
});
