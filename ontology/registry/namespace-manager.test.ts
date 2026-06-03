import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DaemonError } from "@daemon/platform-types";
import { NamespaceManager } from "./namespace-manager.js";

describe("NamespaceManager", () => {
  it("registers and resolves a namespace", () => {
    const m = new NamespaceManager();
    const ns = m.register("core", "platform");
    assert.equal(ns.name, "core");
    assert.equal(m.resolve("core").owner, "platform");
    assert.equal(m.has("core"), true);
  });

  it("rejects invalid names", () => {
    const m = new NamespaceManager();
    assert.throws(() => m.register("Bad Name", "x"), DaemonError);
  });

  it("rejects duplicate registration", () => {
    const m = new NamespaceManager();
    m.register("core", "a");
    assert.throws(() => m.register("core", "b"), DaemonError);
  });

  it("throws resolving an unknown namespace", () => {
    assert.throws(() => new NamespaceManager().resolve("missing"), DaemonError);
  });
});
