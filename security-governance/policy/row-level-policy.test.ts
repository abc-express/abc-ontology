import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RowLevelPolicy } from "./row-level-policy.js";

const rows = [
  { id: "1", tenantId: "t1", ownerId: "alice" },
  { id: "2", tenantId: "t1", ownerId: "bob" },
  { id: "3", tenantId: "t2", ownerId: "carol" },
];

describe("RowLevelPolicy", () => {
  it("enforces tenant isolation", () => {
    const policy = new RowLevelPolicy();
    const visible = policy.filter(rows, {
      tenantId: "t1",
      subjectId: "alice",
      roles: ["user"],
    });
    assert.deepEqual(
      visible.map((r) => r.id),
      ["1", "2"],
    );
  });

  it("scopes to owner when ownerOnly is set", () => {
    const policy = new RowLevelPolicy({ ownerOnly: true });
    const visible = policy.filter(rows, {
      tenantId: "t1",
      subjectId: "alice",
      roles: ["user"],
    });
    assert.deepEqual(
      visible.map((r) => r.id),
      ["1"],
    );
  });

  it("lets bypass roles see everything", () => {
    const policy = new RowLevelPolicy({ bypassRoles: ["admin"] });
    const visible = policy.filter(rows, {
      tenantId: "t1",
      subjectId: "alice",
      roles: ["admin"],
    });
    assert.equal(visible.length, 3);
  });
});
