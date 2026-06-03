import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveSchema } from "./schema-resolver.ts";

test("resolveSchema returns the registered schema", () => {
  const contact = { fields: ["name"] };
  assert.equal(resolveSchema("contact", { contact }), contact);
});

test("resolveSchema throws for an unknown type", () => {
  assert.throws(() => resolveSchema("missing", {}), /unknown schema: missing/);
});
