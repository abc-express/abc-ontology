import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { DaemonError, ErrorCodes } from "@daemon/platform-types";
import type { WriteCommand } from "./command-gateway.js";

interface WriteLogicRule {
  readonly id: string;
  readonly denyPatchKeys?: readonly string[];
  readonly requireRole?: string;
}

let cachedRules: WriteLogicRule[] | null = null;

function getRules(): WriteLogicRule[] {
  if (cachedRules) return cachedRules;
  const root = process.env.DAEMON_REPO_ROOT ?? process.cwd();
  const path = join(root, "configs/ontology/packs/foundation/write-logic.yaml");
  if (!existsSync(path)) {
    cachedRules = [];
    return cachedRules;
  }
  const doc = parseYaml(readFileSync(path, "utf8")) as {
    rules?: WriteLogicRule[];
  };
  cachedRules = doc.rules ?? [];
  return cachedRules;
}

export function assertWriteLogicAllowed(cmd: WriteCommand): void {
  const roles = cmd.session.roles ?? [];
  for (const rule of getRules()) {
    if (rule.denyPatchKeys) {
      for (const key of rule.denyPatchKeys) {
        if (key in cmd.patch) {
          if (rule.requireRole && !roles.includes(rule.requireRole)) {
            throw new DaemonError(
              ErrorCodes.POLICY_DENIED,
              `write logic ${rule.id}: patch key ${key} requires role ${rule.requireRole}`,
              403,
            );
          }
        }
      }
    }
  }
}
