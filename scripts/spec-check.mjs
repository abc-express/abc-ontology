#!/usr/bin/env node
/**
 * Spec tree completeness gate.
 *
 * Source of truth: the file tree fenced block in
 * docs/reference/perplexity-architecture-spec.md (rooted at
 * `daemon-ontology-platform/`). This script parses that tree, derives the set
 * of required files and directories, and verifies they exist in the repo.
 *
 * Usage:
 *   node scripts/spec-check.mjs            validate; exit 1 if anything missing
 *   node scripts/spec-check.mjs --manifest write scripts/spec-tree-manifest.json
 *   node scripts/spec-check.mjs --fix      create missing directories (.gitkeep)
 */
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const specPath = join(root, "docs/reference/perplexity-architecture-spec.md");
const manifestPath = join(here, "spec-tree-manifest.json");

/**
 * Extract the first fenced block whose first content line is the project root,
 * then parse the ASCII tree into relative paths.
 * @returns {{path: string, kind: "file"|"dir"}[]}
 */
function parseSpecTree() {
  const md = readFileSync(specPath, "utf8");
  const lines = md.split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "daemon-ontology-platform/") {
      start = i;
      break;
    }
  }
  if (start === -1) {
    throw new Error("Could not locate `daemon-ontology-platform/` tree root in spec.");
  }
  const out = [];
  const stack = [];
  for (let i = start + 1; i < lines.length; i++) {
    const raw = lines[i].replace(/\s+$/u, "");
    if (raw.startsWith("```")) break; // end of fenced block
    if (!raw.trim()) continue;
    const branch = raw.indexOf("├── ");
    const leaf = raw.indexOf("└── ");
    const idx = branch === -1 ? leaf : leaf === -1 ? branch : Math.min(branch, leaf);
    if (idx === -1) continue;
    const prefix = raw.slice(0, idx);
    const level = Math.round(prefix.length / 4);
    let name = raw.slice(idx + 4).trim();
    if (!name) continue;
    const isDir = name.endsWith("/");
    if (isDir) name = name.slice(0, -1);
    stack[level] = name;
    stack.length = level + 1;
    out.push({ path: stack.join("/"), kind: isDir ? "dir" : "file" });
  }
  return out;
}

function buildManifest() {
  const entries = parseSpecTree();
  const files = entries.filter((e) => e.kind === "file").map((e) => e.path).sort();
  const dirs = entries.filter((e) => e.kind === "dir").map((e) => e.path).sort();
  return { generatedFrom: "docs/reference/perplexity-architecture-spec.md", files, dirs };
}

function validate(manifest) {
  const missing = [];
  for (const f of manifest.files) {
    const abs = join(root, f);
    if (!existsSync(abs) || !statSync(abs).isFile()) missing.push({ path: f, kind: "file" });
  }
  for (const d of manifest.dirs) {
    const abs = join(root, d);
    if (!existsSync(abs) || !statSync(abs).isDirectory()) missing.push({ path: d, kind: "dir" });
  }
  return missing;
}

const args = new Set(process.argv.slice(2));

if (args.has("--manifest")) {
  const manifest = buildManifest();
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(
    `spec:check wrote manifest (${manifest.files.length} files, ${manifest.dirs.length} dirs)`,
  );
  process.exit(0);
}

const manifest = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, "utf8"))
  : buildManifest();

if (args.has("--fix")) {
  let created = 0;
  for (const d of manifest.dirs) {
    const abs = join(root, d);
    if (!existsSync(abs)) {
      mkdirSync(abs, { recursive: true });
      writeFileSync(join(abs, ".gitkeep"), "");
      created++;
    }
  }
  console.log(`spec:check --fix created ${created} directories`);
}

const missing = validate(manifest);
if (missing.length > 0) {
  console.error(`spec:check FAILED — ${missing.length} missing paths:`);
  for (const m of missing) console.error(`  [${m.kind}] ${m.path}`);
  process.exit(1);
}
console.log(
  `spec:check OK — ${manifest.files.length} files, ${manifest.dirs.length} dirs present`,
);
