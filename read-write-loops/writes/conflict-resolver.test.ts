import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DaemonError } from "@daemon/platform-types";
import { ConflictResolver } from "./conflict-resolver.js";

describe("ConflictResolver", () => {
  it("applies the patch when versions match", () => {
    const r = new ConflictResolver("reject").resolve({
      currentVersion: 3,
      expectedVersion: 3,
      currentProperties: { a: 1 },
      patch: { b: 2 },
    });
    assert.equal(r.conflict, false);
    assert.deepEqual(r.resolvedProperties, { a: 1, b: 2 });
  });

  it("throws on conflict with reject strategy", () => {
    assert.throws(
      () =>
        new ConflictResolver("reject").resolve({
          currentVersion: 5,
          expectedVersion: 3,
          currentProperties: {},
          patch: {},
        }),
      DaemonError,
    );
  });

  it("overwrites with last-write-wins on conflict", () => {
    const r = new ConflictResolver("last-write-wins").resolve({
      currentVersion: 5,
      expectedVersion: 3,
      currentProperties: { a: 1 },
      patch: { a: 99 },
    });
    assert.equal(r.conflict, true);
    assert.equal(r.resolvedProperties.a, 99);
  });

  it("preserves current values with merge on conflict", () => {
    const r = new ConflictResolver("merge").resolve({
      currentVersion: 5,
      expectedVersion: 3,
      currentProperties: { a: 1 },
      patch: { a: 99, b: 2 },
    });
    assert.equal(r.resolvedProperties.a, 1);
    assert.equal(r.resolvedProperties.b, 2);
  });
});
