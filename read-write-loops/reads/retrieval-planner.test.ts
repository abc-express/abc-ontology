import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { entityId, ontologyId } from "@daemon/platform-types";
import { RetrievalPlanner } from "./retrieval-planner.js";

describe("RetrievalPlanner", () => {
  const planner = new RetrievalPlanner();
  const base = { ontologyId: ontologyId("o"), entityId: entityId("e") };

  it("includes a cache lookup for cached consistency", () => {
    const plan = planner.plan({ ...base, consistency: "cached" });
    assert.equal(plan.usesCache, true);
    assert.equal(plan.steps[0].kind, "cache-lookup");
    assert.equal(plan.projectedFields, null);
  });

  it("skips cache for strong consistency", () => {
    const plan = planner.plan({ ...base, consistency: "strong" });
    assert.equal(plan.usesCache, false);
    assert.equal(plan.steps[0].kind, "registry-read");
  });

  it("adds a projection step when fields are requested", () => {
    const plan = planner.plan({ ...base, fields: ["a", "b"] });
    assert.deepEqual(plan.projectedFields, ["a", "b"]);
    assert.equal(plan.steps.at(-1)?.kind, "projection");
  });
});
