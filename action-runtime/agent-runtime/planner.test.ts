import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DaemonError } from "@daemon/platform-types";
import { Planner } from "./planner.js";

describe("Planner", () => {
  const planner = new Planner(new Set(["fetch", "transform", "load"]));

  it("builds a sequential dependency chain", () => {
    const plan = planner.plan("etl", [
      { capability: "fetch", description: "pull rows" },
      { capability: "transform", description: "clean" },
      { capability: "load", description: "write" },
    ]);
    assert.equal(plan.steps.length, 3);
    assert.deepEqual(plan.steps[0].dependsOn, []);
    assert.deepEqual(plan.steps[1].dependsOn, ["step-1"]);
    assert.deepEqual(plan.steps[2].dependsOn, ["step-2"]);
  });

  it("rejects unknown capabilities", () => {
    assert.throws(
      () => planner.plan("x", [{ capability: "mine-crypto", description: "no" }]),
      (err) => err instanceof DaemonError && err.code === "VALIDATION",
    );
  });

  it("rejects empty goals", () => {
    assert.throws(
      () => planner.plan("  ", [{ capability: "fetch", description: "y" }]),
      (err) => err instanceof DaemonError && err.code === "VALIDATION",
    );
  });
});
