import { test } from "node:test";
import assert from "node:assert/strict";
import { enrichMetadata } from "./metadata-enricher.ts";

test("enrichMetadata merges new metadata and stamps enrichedAt", () => {
  const out = enrichMetadata({ id: "1" }, { source: "crm" });
  const meta = out._meta as Record<string, unknown>;
  assert.equal(out.id, "1");
  assert.equal(meta.source, "crm");
  assert.equal(typeof meta.enrichedAt, "string");
});

test("enrichMetadata preserves existing _meta entries", () => {
  const out = enrichMetadata({ _meta: { tenant: "acme" } }, { source: "crm" });
  const meta = out._meta as Record<string, unknown>;
  assert.equal(meta.tenant, "acme");
  assert.equal(meta.source, "crm");
});
