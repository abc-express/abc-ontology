import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DaemonError } from "@daemon/platform-types";
import { Planner } from "./planner.js";

describe("Planner", () => {
  const planner = new Planner([
    { name: "mine", requires: ["pickaxe"], produces: ["ore"] },
    { name: "smelt", requires: ["ore"], produces: ["ingot"] },
    { name: "forge", requires: ["ingot"], produces: ["sword"] },
  ]);

  it("orders actions to reach the goal", () => {
    const steps = planner.plan(["pickaxe"], "sword");
    assert.deepEqual(steps.map((s) => s.name), ["mine", "smelt", "forge"]);
  });

  it("returns an empty plan when the goal is already available", () => {
    assert.deepEqual(planner.plan(["sword"], "sword"), []);
  });

  it("throws when the goal is unreachable", () => {
    assert.throws(() => planner.plan([], "sword"), DaemonError);
  });
});
