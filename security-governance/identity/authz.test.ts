import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DaemonError } from "@daemon/platform-types";
import { Rbac } from "../policy/rbac.js";
import { Abac } from "../policy/abac.js";
import { Authorizer } from "./authz.js";
import type { Principal } from "./authn.js";

const principal: Principal = {
  subjectId: "alice",
  tenantId: "t1",
  roles: ["editor"],
};

describe("Authorizer", () => {
  it("allows when rbac grants and no abac denies", () => {
    const rbac = new Rbac();
    rbac.define({ role: "editor", permissions: ["write"] });
    const authz = new Authorizer(rbac);
    const decision = authz.authorize({
      principal,
      action: "write",
      resource: { tenantId: "t1" },
    });
    assert.equal(decision.effect, "allow");
  });

  it("denies when rbac lacks the permission", () => {
    const rbac = new Rbac();
    rbac.define({ role: "editor", permissions: ["read"] });
    const authz = new Authorizer(rbac);
    const decision = authz.authorize({
      principal,
      action: "write",
      resource: { tenantId: "t1" },
    });
    assert.equal(decision.effect, "deny");
  });

  it("honors an abac deny even when rbac grants", () => {
    const rbac = new Rbac();
    rbac.define({ role: "editor", permissions: ["write"] });
    const abac = new Abac([
      {
        id: "cross-tenant",
        action: "write",
        effect: "deny",
        match: [{ attribute: "resource.tenantId", operator: "ne", value: "t1" }],
      },
    ]);
    const authz = new Authorizer(rbac, abac);
    const decision = authz.authorize({
      principal,
      action: "write",
      resource: { tenantId: "t2" },
    });
    assert.equal(decision.effect, "deny");
  });

  it("assert throws POLICY_DENIED on deny", () => {
    const rbac = new Rbac();
    rbac.define({ role: "editor", permissions: ["read"] });
    const authz = new Authorizer(rbac);
    assert.throws(
      () =>
        authz.assert({ principal, action: "write", resource: { tenantId: "t1" } }),
      (err) => err instanceof DaemonError && err.code === "POLICY_DENIED",
    );
  });
});
