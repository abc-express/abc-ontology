import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

const FOUNDATION_PACK_MARKER = join(
  "configs",
  "ontology",
  "packs",
  "foundation",
  "pack.yaml",
);

function findRepoRootFrom(start: string): string | undefined {
  let dir = start;
  for (;;) {
    if (existsSync(join(dir, FOUNDATION_PACK_MARKER))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/** Repository root when running CLI, gateway, package tests, or repo tests. */
export function repoRoot(): string {
  if (process.env.DAEMON_REPO_ROOT) {
    return process.env.DAEMON_REPO_ROOT;
  }
  return findRepoRootFrom(process.cwd()) ?? process.cwd();
}

export function configsPath(...segments: string[]): string {
  return join(repoRoot(), "configs", ...segments);
}
