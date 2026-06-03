import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DaemonError } from "@daemon/platform-types";
import { Rbac } from "./rbac.js";

describe("Rbac", () => {
  it("grants permissions held directly by a role", () => {
    const rbac = new Rbac();
    rbac.define({ role: "reader", permissions: ["entity.read"] });
    assert.equal(rbac.can(["reader"], "entity.read"), true);
    assert.equal(rbac.can(["reader"], "entity.write"), false);
  });

  it("resolves inherited permissions", () => {
    const rbac = new Rbac();
    rbac.define({ role: "reader", permissions: ["entity.read"] });
    rbac.define({
      role: "editor",
      permissions: ["entity.write"],
      inherits: ["reader"],
    });
    assert.equal(rbac.can(["editor"], "entity.read"), true);
    assert.equal(rbac.can(["editor"], "entity.write"), true);
  });

  it("treats wildcard as full access", () => {
    const rbac = new Rbac();
    rbac.define({ role: "admin", permissions: ["*"] });
    assert.equal(rbac.can(["admin"], "anything.at.all"), true);
  });

  it("asserts and throws when permission is missing", () => {
    const rbac = new Rbac();
    rbac.define({ role: "reader", permissions: ["entity.read"] });
    assert.throws(() => rbac.assert(["reader"], "entity.delete"), DaemonError);
  });
});
