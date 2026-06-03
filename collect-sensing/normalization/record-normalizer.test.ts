import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RecordNormalizer } from "./record-normalizer.js";
import type { RawRecord } from "../connectors/connector.js";

describe("RecordNormalizer", () => {
  const config = {
    ontologyId: "crm.contact",
    mapping: { contact_id: "id", full_name: "name", email_addr: "email" },
    idField: "id",
    meta: { pipeline: "batch" },
  };

  it("maps source fields to canonical names and enriches metadata", () => {
    const normalizer = new RecordNormalizer(config);
    const record: RawRecord = {
      sourceId: "crm-main",
      recordId: "c-1",
      payload: { contact_id: "c-1", full_name: "Ada", email_addr: "a@x.io", junk: 1 },
    };

    const payload = normalizer.normalize(record);

    assert.equal(payload.ontologyId, "crm.contact");
    assert.equal(payload.entityId, "c-1");
    assert.equal(payload.properties.id, "c-1");
    assert.equal(payload.properties.name, "Ada");
    assert.equal(payload.properties.email, "a@x.io");
    assert.ok(!("junk" in payload.properties), "unmapped fields are dropped");
    const meta = payload.properties._meta as Record<string, unknown>;
    assert.equal(meta.sourceId, "crm-main");
    assert.equal(meta.recordId, "c-1");
    assert.equal(meta.pipeline, "batch");
    assert.equal(typeof meta.enrichedAt, "string");
  });

  it("derives entityId from idField when recordId is absent", () => {
    const normalizer = new RecordNormalizer(config);
    const payload = normalizer.normalize({
      sourceId: "crm-main",
      payload: { contact_id: 42, full_name: "Lin" },
    });
    assert.equal(payload.entityId, "42");
  });

  it("omits entityId when neither recordId nor idField resolves", () => {
    const normalizer = new RecordNormalizer({
      ontologyId: "crm.contact",
      mapping: { full_name: "name" },
    });
    const payload = normalizer.normalize({
      sourceId: "crm-main",
      payload: { full_name: "Anon" },
    });
    assert.equal(payload.entityId, undefined);
    assert.equal(payload.properties.name, "Anon");
  });

  it("normalizes batches in order", () => {
    const normalizer = new RecordNormalizer(config);
    const payloads = normalizer.normalizeMany([
      { sourceId: "s", recordId: "1", payload: { contact_id: "1" } },
      { sourceId: "s", recordId: "2", payload: { contact_id: "2" } },
    ]);
    assert.deepEqual(
      payloads.map((p) => p.entityId),
      ["1", "2"],
    );
  });

  it("rejects empty ontologyId and empty mapping", () => {
    assert.throws(() => new RecordNormalizer({ ontologyId: " ", mapping: { a: "b" } }));
    assert.throws(() => new RecordNormalizer({ ontologyId: "x", mapping: {} }));
  });
});
