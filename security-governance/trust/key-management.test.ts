import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DaemonError } from "@daemon/platform-types";
import { KeyManagement } from "./key-management.js";

describe("KeyManagement", () => {
  it("makes the first registered key active", () => {
    const km = new KeyManagement();
    km.register("k1", "secret-1");
    assert.equal(km.active().id, "k1");
  });

  it("rotates active key and demotes the previous one", () => {
    const km = new KeyManagement();
    km.register("k1", "secret-1");
    km.register("k2", "secret-2");
    assert.equal(km.active().id, "k1");
    km.rotateTo("k2");
    assert.equal(km.active().id, "k2");
  });

  it("revokes the active key leaving none active", () => {
    const km = new KeyManagement();
    km.register("k1", "secret-1");
    km.revoke("k1");
    assert.throws(
      () => km.active(),
      (err) => err instanceof DaemonError && err.code === "NOT_FOUND",
    );
  });

  it("refuses to activate a revoked key", () => {
    const km = new KeyManagement();
    km.register("k1", "secret-1");
    km.register("k2", "secret-2");
    km.revoke("k2");
    assert.throws(
      () => km.rotateTo("k2"),
      (err) => err instanceof DaemonError && err.code === "CONFLICT",
    );
  });
});
