import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FileIngestConnector } from "./file-ingest-connector.js";

describe("FileIngestConnector", () => {
  it("parses JSONL into raw records", () => {
    const c = new FileIngestConnector({ sourceId: "files", format: "jsonl" });
    const records = c.parse('{"id":"1","v":10}\n\n{"id":"2","v":20}\n');
    assert.equal(records.length, 2);
    assert.equal(records[0]?.recordId, "1");
    assert.deepEqual(records[1]?.payload, { id: "2", v: 20 });
  });

  it("rejects non-object JSONL lines", () => {
    const c = new FileIngestConnector({ sourceId: "files", format: "jsonl" });
    assert.throws(() => c.parse("[1,2,3]"), /not an object/);
  });

  it("parses CSV with a header row", () => {
    const c = new FileIngestConnector({
      sourceId: "files",
      format: "csv",
      recordIdKey: "sku",
    });
    const records = c.parse("sku,name\nA1,Widget\nB2,Gadget\n");
    assert.equal(records.length, 2);
    assert.equal(records[0]?.recordId, "A1");
    assert.deepEqual(records[1]?.payload, { sku: "B2", name: "Gadget" });
  });

  it("honors quoted CSV fields containing the delimiter", () => {
    const c = new FileIngestConnector({ sourceId: "files", format: "csv" });
    const records = c.parse('id,label\n1,"a, b"\n');
    assert.deepEqual(records[0]?.payload, { id: "1", label: "a, b" });
  });

  it("stages content for fetch()", async () => {
    const c = new FileIngestConnector({ sourceId: "files", format: "jsonl" });
    c.stage('{"id":"7"}');
    const records = await c.fetch();
    assert.equal(records[0]?.recordId, "7");
  });

  it("throws when fetch() is called before staging", async () => {
    const c = new FileIngestConnector({ sourceId: "files", format: "jsonl" });
    await assert.rejects(() => c.fetch(), /call parse/);
  });
});
