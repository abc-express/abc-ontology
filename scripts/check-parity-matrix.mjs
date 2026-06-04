#!/usr/bin/env node
/**
 * Validates docs/19-product-parity-matrix.md: every Live row must cite an existing evidence path.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const matrixPath = join(root, "docs/19-product-parity-matrix.md");

function main() {
  if (!existsSync(matrixPath)) {
    console.error("check-parity-matrix FAILED: missing docs/19-product-parity-matrix.md");
    process.exit(1);
  }
  const text = readFileSync(matrixPath, "utf8");
  const rows = [...text.matchAll(/\|\s*[^|]+\|\s*[^|]+\|\s*Live\s*\|[^|]*\|\s*([^|]+)\s*\|/g)];
  const failures = [];
  for (const m of rows) {
    const evidence = m[1].trim().replace(/`/g, "");
    if (!evidence) {
      failures.push("Live row with empty evidence");
      continue;
    }
    const path = evidence.split(/\s+/)[0];
    const full = join(root, path);
    if (!existsSync(full)) {
      failures.push(`Live evidence missing: ${path}`);
    }
  }
  if (failures.length) {
    console.error("check-parity-matrix FAILED:");
    for (const f of failures) console.error(`  ${f}`);
    process.exit(1);
  }
  console.log(`check-parity-matrix OK — ${rows.length} Live rows verified`);
}

main();
