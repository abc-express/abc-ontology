import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FieldLevelPolicy } from "./field-level-policy.js";

describe("FieldLevelPolicy", () => {
  it("masks fields below the required clearance", () => {
    const policy = new FieldLevelPolicy([
      { field: "ssn", minClearance: 3 },
      { field: "salary", minClearance: 2, mask: "REDACTED" },
    ]);
    const masked = policy.apply({ name: "Alice", ssn: "123", salary: 100 }, 2);
    assert.equal(masked.name, "Alice");
    assert.equal(masked.ssn, "***");
    assert.equal(masked.salary, 100);
  });

  it("reveals raw values when clearance is sufficient", () => {
    const policy = new FieldLevelPolicy([{ field: "ssn", minClearance: 3 }]);
    const open = policy.apply({ name: "Alice", ssn: "123" }, 5);
    assert.equal(open.ssn, "123");
  });

  it("does not introduce fields that were absent", () => {
    const policy = new FieldLevelPolicy([{ field: "ssn", minClearance: 3 }]);
    const masked = policy.apply({ name: "Alice" }, 0);
    assert.equal("ssn" in masked, false);
  });
});
