import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DaemonError } from "@daemon/platform-types";
import { LineageTracker } from "./lineage-tracker.js";

describe("LineageTracker", () => {
  it("traces transitive ancestry", () => {
    let t = 0;
    const tracker = new LineageTracker(() => ++t);
    for (const id of ["raw", "clean", "feature", "model"]) {
      tracker.declare({ id, kind: "dataset" });
    }
    tracker.derive("clean", ["raw"], "normalize");
    tracker.derive("feature", ["clean"], "extract");
    tracker.derive("model", ["feature"], "train");

    assert.deepEqual(tracker.ancestors("model"), ["clean", "feature", "raw"]);
    assert.deepEqual(tracker.ancestors("raw"), []);
  });

  it("rejects deriving from undeclared nodes", () => {
    const tracker = new LineageTracker();
    tracker.declare({ id: "out", kind: "dataset" });
    assert.throws(
      () => tracker.derive("out", ["ghost"], "merge"),
      (err) => err instanceof DaemonError && err.code === "NOT_FOUND",
    );
  });

  it("records ordered history", () => {
    let t = 0;
    const tracker = new LineageTracker(() => ++t);
    tracker.declare({ id: "a", kind: "x" });
    tracker.declare({ id: "b", kind: "x" });
    tracker.derive("b", ["a"], "copy");
    const history = tracker.history();
    assert.equal(history.length, 1);
    assert.equal(history[0].operation, "copy");
  });
});
