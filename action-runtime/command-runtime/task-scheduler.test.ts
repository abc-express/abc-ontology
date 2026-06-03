import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DaemonError } from "@daemon/platform-types";
import { TaskScheduler } from "./task-scheduler.js";

describe("TaskScheduler", () => {
  const scheduler = new TaskScheduler();

  it("orders dependencies before dependents", () => {
    const order = scheduler.order([
      { id: "c", dependsOn: ["b"] },
      { id: "b", dependsOn: ["a"] },
      { id: "a", dependsOn: [] },
    ]);
    assert.deepEqual(order, ["a", "b", "c"]);
  });

  it("detects cycles", () => {
    assert.throws(
      () =>
        scheduler.order([
          { id: "a", dependsOn: ["b"] },
          { id: "b", dependsOn: ["a"] },
        ]),
      (err) => err instanceof DaemonError && err.code === "CONFLICT",
    );
  });

  it("rejects unknown dependencies", () => {
    assert.throws(
      () => scheduler.order([{ id: "a", dependsOn: ["ghost"] }]),
      (err) => err instanceof DaemonError && err.code === "VALIDATION",
    );
  });
});
