import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DaemonError } from "@daemon/platform-types";
import { EntityResolver } from "./entity-resolver.js";

describe("EntityResolver", () => {
  it("resolves aliases case-insensitively", () => {
    const r = new EntityResolver();
    r.register("entity:1", ["Acme Corp", "ACME"]);
    assert.equal(r.resolve("acme corp"), "entity:1");
    assert.equal(r.resolve("acme"), "entity:1");
    assert.equal(r.resolve("entity:1"), "entity:1");
  });

  it("returns undefined for unknown aliases", () => {
    assert.equal(new EntityResolver().resolve("nope"), undefined);
  });

  it("rejects alias collisions across canonical ids", () => {
    const r = new EntityResolver();
    r.register("entity:1", ["shared"]);
    assert.throws(() => r.register("entity:2", ["shared"]), DaemonError);
  });

  it("throws via resolveOrThrow when missing", () => {
    assert.throws(() => new EntityResolver().resolveOrThrow("x"), DaemonError);
  });
});
