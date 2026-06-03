import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { InMemorySystemAdapter } from "./system-adapter.js";

describe("InMemorySystemAdapter", () => {
  it("pull returns seeded records", async () => {
    const adapter = new InMemorySystemAdapter("sim-crm");
    adapter.seed("contacts", [{ externalId: "c1", properties: { name: "Ada" } }]);
    const rows = await adapter.pull({ systemId: "sim-crm", resource: "contacts" });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.properties.name, "Ada");
  });
});
