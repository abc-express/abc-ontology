#!/usr/bin/env node
/**
 * Regenerate pack SDK and fail if generated output would change (stale check).
 */
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const genScript = join(root, "scripts/generate-pack-sdk.mjs");
const generatedDir = join(root, "packages/sdk/src/generated/foundation");

function snapshot(dir) {
  if (!existsSync(dir)) return {};
  const out = {};
  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith(".ts")) continue;
    out[name] = readFileSync(join(dir, name), "utf8");
  }
  return out;
}

function main() {
  const before = snapshot(generatedDir);
  const gen = spawnSync(process.execPath, [genScript, "--pack", "foundation"], {
    cwd: root,
    stdio: "inherit",
  });
  if (gen.status !== 0) process.exit(gen.status ?? 1);
  const after = snapshot(generatedDir);
  const names = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed = [];
  for (const name of [...names].sort()) {
    if (before[name] !== after[name]) changed.push(name);
  }
  if (changed.length) {
    console.error("codegen:check FAILED — generated output is stale. Run:");
    console.error("  node scripts/generate-pack-sdk.mjs");
    console.error(`  changed: ${changed.join(", ")}`);
    process.exit(1);
  }
  console.log("codegen:check OK — foundation pack SDK is up to date");
}

main();
