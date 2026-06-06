import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { SourceCatalog } from "./source-catalog.js";

describe("SourceCatalog", () => {
  it("loads demo-parties from repo sources.yaml", () => {
    const root = join(import.meta.dirname, "..", "..");
    process.env.DAEMON_REPO_ROOT = root;
    const catalog = SourceCatalog.fromYamlFile();
    const source = catalog.require("demo-parties");
    assert.equal(source.normalize.ontologyId, "foundation");
    assert.equal(source.normalize.entityType, "Party");
    assert.equal(source.connector.type, "file");
    if (source.connector.type === "file") {
      assert.equal(source.connector.path, "tests/fixtures/ingest/parties.jsonl");
    }
  });

  it("throws for unknown source", () => {
    const root = join(import.meta.dirname, "..", "..");
    process.env.DAEMON_REPO_ROOT = root;
    const catalog = SourceCatalog.fromYamlFile();
    assert.throws(() => catalog.require("missing-source"), /unknown ingest source/);
  });

  it("parses postgres-read connectionEnv from abc-antero sources", () => {
    const root = join(import.meta.dirname, "..", "..");
    process.env.DAEMON_REPO_ROOT = root;
    delete process.env.DAEMON_ABC_LIVE_INGEST;
    const catalog = SourceCatalog.fromYamlFile();
    const source = catalog.get("abc-antero-pos-ttk");
    assert.ok(source);
    assert.equal(source!.connector.type, "postgres-read");
    if (source!.connector.type === "postgres-read") {
      assert.equal(source!.connector.connectionEnv, "ANTERO_SUPABASE_DB_URL");
    }
  });

  it("enables abc-antero-* when DAEMON_ABC_LIVE_INGEST and ANTERO_SUPABASE_DB_URL are set", () => {
    const root = join(import.meta.dirname, "..", "..");
    process.env.DAEMON_REPO_ROOT = root;
    process.env.DAEMON_ABC_LIVE_INGEST = "1";
    process.env.ANTERO_SUPABASE_DB_URL = "postgresql://antero/read";
    try {
      const catalog = SourceCatalog.fromYamlFile();
      assert.doesNotThrow(() => catalog.require("abc-antero-pos-ttk"));
    } finally {
      delete process.env.DAEMON_ABC_LIVE_INGEST;
      delete process.env.ANTERO_SUPABASE_DB_URL;
    }
  });
});
