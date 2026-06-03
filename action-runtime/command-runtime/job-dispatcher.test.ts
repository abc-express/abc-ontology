import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DaemonError } from "@daemon/platform-types";
import { JobDispatcher } from "./job-dispatcher.js";

describe("JobDispatcher", () => {
  it("drives a job through to success", () => {
    const d = new JobDispatcher();
    d.enqueue("j1");
    d.start("j1");
    const done = d.complete("j1");
    assert.equal(done.status, "succeeded");
    assert.equal(done.attempts, 1);
    assert.deepEqual(d.pending(), []);
  });

  it("retries failed jobs until the ceiling", () => {
    const d = new JobDispatcher(2);
    d.enqueue("j1");
    d.start("j1");
    d.complete("j1", "boom");
    const requeued = d.retry("j1");
    assert.equal(requeued.status, "queued");
    d.start("j1");
    d.complete("j1", "boom again");
    assert.equal(d.get("j1").attempts, 2);
    assert.throws(
      () => d.retry("j1"),
      (err) => err instanceof DaemonError && err.code === "CONFLICT",
    );
  });

  it("rejects illegal transitions", () => {
    const d = new JobDispatcher();
    d.enqueue("j1");
    assert.throws(
      () => d.complete("j1"),
      (err) => err instanceof DaemonError && err.code === "CONFLICT",
    );
  });

  it("rejects duplicate and unknown jobs", () => {
    const d = new JobDispatcher();
    d.enqueue("j1");
    assert.throws(
      () => d.enqueue("j1"),
      (err) => err instanceof DaemonError && err.code === "CONFLICT",
    );
    assert.throws(
      () => d.start("ghost"),
      (err) => err instanceof DaemonError && err.code === "NOT_FOUND",
    );
  });
});
