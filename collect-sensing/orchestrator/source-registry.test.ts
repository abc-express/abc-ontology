import { test } from "node:test";
import assert from "node:assert/strict";
import { SourceRegistryClient } from "./source-registry.ts";

test("SourceRegistryClient registers and retrieves sources by id", () => {
  const reg = new SourceRegistryClient();
  reg.register({ id: "crm-main", type: "api", config: { url: "https://crm" } });
  const got = reg.get("crm-main");
  assert.equal(got?.type, "api");
  assert.deepEqual(got?.config, { url: "https://crm" });
});

test("SourceRegistryClient lists all registered sources", () => {
  const reg = new SourceRegistryClient();
  reg.register({ id: "a", type: "db", config: {} });
  reg.register({ id: "b", type: "file", config: {} });
  assert.deepEqual(reg.list().map((s) => s.id).sort(), ["a", "b"]);
  assert.equal(reg.get("missing"), undefined);
});
