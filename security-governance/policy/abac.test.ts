import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Abac } from "./abac.js";

describe("Abac", () => {
  it("allows when an allow rule matches all conditions", () => {
    const abac = new Abac([
      {
        id: "same-tenant-read",
        action: "read",
        effect: "allow",
        match: [
          { attribute: "subject.tenantId", operator: "eq", value: "t1" },
          { attribute: "resource.tenantId", operator: "eq", value: "t1" },
        ],
      },
    ]);
    const decision = abac.evaluate({
      action: "read",
      subject: { tenantId: "t1" },
      resource: { tenantId: "t1" },
    });
    assert.equal(decision.effect, "allow");
  });

  it("lets explicit deny override allow", () => {
    const abac = new Abac([
      {
        id: "allow-all-read",
        action: "read",
        effect: "allow",
        match: [{ attribute: "subject.role", operator: "eq", value: "user" }],
      },
      {
        id: "deny-quarantined",
        action: "*",
        effect: "deny",
        match: [{ attribute: "resource.quarantined", operator: "eq", value: true }],
      },
    ]);
    const decision = abac.evaluate({
      action: "read",
      subject: { role: "user" },
      resource: { quarantined: true },
    });
    assert.equal(decision.effect, "deny");
    assert.match(decision.reason ?? "", /deny-quarantined/);
  });

  it("supports in and numeric operators", () => {
    const abac = new Abac([
      {
        id: "clearance",
        action: "read",
        effect: "allow",
        match: [
          { attribute: "subject.dept", operator: "in", value: ["fin", "ops"] },
          { attribute: "subject.level", operator: "gte", value: 3 },
        ],
      },
    ]);
    assert.equal(
      abac.evaluate({
        action: "read",
        subject: { dept: "ops", level: 5 },
        resource: {},
      }).effect,
      "allow",
    );
    assert.equal(
      abac.evaluate({
        action: "read",
        subject: { dept: "ops", level: 2 },
        resource: {},
      }).effect,
      "deny",
    );
  });

  it("denies by default when no rule matches", () => {
    const abac = new Abac();
    assert.equal(
      abac.evaluate({ action: "delete", subject: {}, resource: {} }).effect,
      "deny",
    );
  });
});
