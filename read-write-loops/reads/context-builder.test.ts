import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ontologyId, entityId } from "@daemon/platform-types";
import { ContextBuilder } from "./context-builder.js";

describe("ContextBuilder", () => {
  const builder = new ContextBuilder();
  const base = { ontologyId: ontologyId("o"), entityId: entityId("e") };

  it("applies deterministic defaults", () => {
    const ctx = builder.build(base);
    assert.equal(ctx.key, "o:e");
    assert.equal(ctx.principal, "anonymous");
    assert.equal(ctx.consistency, "strong");
    assert.equal(ctx.requestedFields, null);
  });

  it("dedupes and sorts requested fields", () => {
    const ctx = builder.build({ ...base, requestedFields: ["b", "a", "b"] });
    assert.deepEqual(ctx.requestedFields, ["a", "b"]);
  });

  it("preserves provided principal and consistency", () => {
    const ctx = builder.build({ ...base, principal: "svc", consistency: "cached" });
    assert.equal(ctx.principal, "svc");
    assert.equal(ctx.consistency, "cached");
  });
});
