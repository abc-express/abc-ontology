import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OutboundPolicy } from "./outbound-policy.js";

describe("OutboundPolicy", () => {
  const policy = new OutboundPolicy({
    allowedSystems: ["erp"],
    deniedOperations: ["delete"],
  });

  it("allows permitted system + operation", () => {
    assert.equal(policy.authorize({ system: "erp", operation: "upsert" }).allowed, true);
  });

  it("blocks systems not on the allow-list", () => {
    const d = policy.authorize({ system: "crm", operation: "upsert" });
    assert.equal(d.allowed, false);
    assert.match(d.reason, /system not allowed/);
  });

  it("blocks denied operations", () => {
    const d = policy.authorize({ system: "erp", operation: "delete" });
    assert.equal(d.allowed, false);
    assert.match(d.reason, /operation denied/);
  });
});
