import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalMap } from "./canonical-mapper.ts";

test("canonicalMap renames mapped keys present in the raw record", () => {
  const out = canonicalMap(
    { first_name: "Ada", last_name: "Lovelace", ignored: 1 },
    { first_name: "givenName", last_name: "familyName" },
  );
  assert.deepEqual(out, { givenName: "Ada", familyName: "Lovelace" });
});

test("canonicalMap skips mapping sources absent from the raw record", () => {
  const out = canonicalMap({ a: 1 }, { a: "x", b: "y" });
  assert.deepEqual(out, { x: 1 });
  assert.ok(!("y" in out));
});
