import { readFileSync, existsSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { configsPath } from "../paths.js";

export type CatalogPolicyRule = {
  action: string;
  resource: string;
  effect: "allow" | "deny";
};

export interface OnCommittedStep {
  workflow: string;
  action: string;
}

export interface ActionCatalogEntry {
  id: string;
  resource: string;
  effect: "allow" | "deny";
  onCommitted?: OnCommittedStep[];
}

export interface ActionCatalogManifest {
  actions: ActionCatalogEntry[];
}

/** Gateway routes that must be backed by the catalog. */
export const REQUIRED_GATEWAY_POLICY_PAIRS: { action: string; resource: string }[] = [
  { action: "read", resource: "entity" },
  { action: "write", resource: "entity" },
  { action: "ingest", resource: "ingest-job" },
  { action: "ingest", resource: "ingest-source" },
  { action: "ingest", resource: "ingest-record" },
  { action: "query", resource: "ontology-nl" },
];

export function parseActionCatalog(raw: unknown): ActionCatalogManifest {
  if (!raw || typeof raw !== "object") {
    throw new Error("action-catalog.yaml must be an object with actions array");
  }
  const actions = (raw as { actions?: unknown }).actions;
  if (!Array.isArray(actions) || actions.length === 0) {
    throw new Error("action-catalog.yaml must define a non-empty actions array");
  }
  const parsed: ActionCatalogEntry[] = actions.map((row, i) => {
    const a = row as Record<string, unknown>;
    if (typeof a.id !== "string" || typeof a.resource !== "string") {
      throw new Error(`action-catalog entry ${i}: id and resource required`);
    }
    if (a.effect !== "allow" && a.effect !== "deny") {
      throw new Error(`action-catalog entry ${i}: effect must be allow or deny`);
    }
    let onCommitted: OnCommittedStep[] | undefined;
    if (a.onCommitted !== undefined) {
      if (!Array.isArray(a.onCommitted)) {
        throw new Error(`action-catalog entry ${i}: onCommitted must be an array`);
      }
      onCommitted = a.onCommitted.map((s, j) => {
        const step = s as Record<string, unknown>;
        if (typeof step.workflow !== "string" || typeof step.action !== "string") {
          throw new Error(`action-catalog entry ${i} onCommitted[${j}]: workflow and action required`);
        }
        return { workflow: step.workflow, action: step.action };
      });
    }
    return {
      id: a.id,
      resource: a.resource,
      effect: a.effect,
      onCommitted,
    };
  });
  return { actions: parsed };
}

export function actionCatalogToPolicyRules(manifest: ActionCatalogManifest): CatalogPolicyRule[] {
  return manifest.actions.map((a) => ({
    action: a.id,
    resource: a.resource,
    effect: a.effect,
  }));
}

export function loadActionCatalog(path?: string): ActionCatalogManifest {
  const file = path ?? configsPath("governance", "action-catalog.yaml");
  if (!existsSync(file)) {
    throw new Error(`action catalog not found: ${file}`);
  }
  const raw = parseYaml(readFileSync(file, "utf8"));
  return parseActionCatalog(raw);
}

export function loadActionCatalogPolicyRules(path?: string): CatalogPolicyRule[] {
  return actionCatalogToPolicyRules(loadActionCatalog(path));
}

export function onCommittedStepsFor(
  manifest: ActionCatalogManifest,
  action: string,
  resource: string,
): OnCommittedStep[] {
  const entry = manifest.actions.find((a) => a.id === action && a.resource === resource);
  return entry?.onCommitted ?? [];
}

export function toWorkflowSteps(steps: OnCommittedStep[]): { id: string; action: string }[] {
  return steps.map((s) => ({ id: s.workflow, action: s.action }));
}
