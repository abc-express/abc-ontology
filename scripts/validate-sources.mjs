#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

const root = join(import.meta.dirname, "..");
const catalogPath = join(root, "configs", "collect-sensing", "connectors-catalog.yaml");
const sourcesPath = join(root, "configs", "collect-sensing", "sources.yaml");

let failed = false;

function fail(msg) {
  console.error(msg);
  failed = true;
}

if (!existsSync(catalogPath)) {
  fail("connectors-catalog.yaml missing");
  process.exit(1);
}

const catalog = parseYaml(readFileSync(catalogPath, "utf8"));
const knownTypes = new Set(
  (catalog.connectorTypes ?? []).map((c) => c.type).filter(Boolean),
);

if (knownTypes.size < 4) {
  fail("connectors-catalog must list at least 4 connector types");
}

if (!existsSync(sourcesPath)) {
  fail("sources.yaml missing");
  process.exit(1);
}

const sourcesDoc = parseYaml(readFileSync(sourcesPath, "utf8"));
const sources = sourcesDoc.sources ?? [];

for (const src of sources) {
  if (!src.id) fail("source missing id");
  const type = src.connector?.type;
  if (!type) fail(`source ${src.id}: connector.type required`);
  if (!knownTypes.has(type)) {
    fail(`source ${src.id}: unknown connector type ${type}`);
  }
}

if (!failed) {
  console.log(
    `check:sources OK (${knownTypes.size} connector types, ${sources.length} sources)`,
  );
}
process.exit(failed ? 1 : 0);
