#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

const root = join(import.meta.dirname, "..");
let failed = false;

const PROPAGATION_TARGETS = new Set([
  "read-model-projection",
  "audit-loop",
  "graph-edge-sync",
  "neo4j-graph-sync",
  "materialized-view:case-by-status",
  "materialized-view:party-by-kind",
]);

const REQUIRED_GATEWAY_POLICY_PAIRS = [
  { action: "read", resource: "entity" },
  { action: "write", resource: "entity" },
  { action: "ingest", resource: "ingest-job" },
  { action: "ingest", resource: "ingest-source" },
  { action: "ingest", resource: "ingest-record" },
  { action: "query", resource: "ontology-nl" },
];

function fail(msg) {
  console.error(msg);
  failed = true;
}

function loadYaml(rel) {
  const p = join(root, rel);
  if (!existsSync(p)) {
    fail(`missing ${rel}`);
    return null;
  }
  return parseYaml(readFileSync(p, "utf8"));
}

const policies = loadYaml("configs/policies/governance-policies.yaml");
const propagation = loadYaml("configs/governance/propagation.yaml");
const actions = loadYaml("configs/governance/action-catalog.yaml");

if (policies) {
  if (!policies.version) fail("governance-policies.yaml missing version");
  if (!Array.isArray(policies.approvalGates)) {
    fail("governance-policies.yaml must define approvalGates");
  } else {
    const schemaGate = policies.approvalGates.find(
      (g) => g.resource === "schema-change",
    );
    if (!schemaGate) {
      fail("governance-policies.yaml must include schema-change approval gate");
    }
  }
}

if (propagation) {
  if (!Array.isArray(propagation.rules)) {
    fail("propagation.yaml must define rules array");
  } else {
    for (const rule of propagation.rules) {
      if (!rule.trigger || !Array.isArray(rule.propagate)) {
        fail(`invalid propagation rule: ${JSON.stringify(rule)}`);
      }
      for (const target of rule.propagate) {
        if (!PROPAGATION_TARGETS.has(target)) {
          fail(`unknown propagation target: ${target}`);
        }
      }
    }
  }
}

if (actions) {
  if (!Array.isArray(actions.actions) || actions.actions.length === 0) {
    fail("action-catalog.yaml must define actions");
  } else {
    for (const { action, resource } of REQUIRED_GATEWAY_POLICY_PAIRS) {
      const found = actions.actions.some(
        (a) => a.id === action && a.resource === resource && a.effect === "allow",
      );
      if (!found) {
        fail(
          `action-catalog.yaml missing allow rule for gateway @PolicyCheck("${action}", "${resource}")`,
        );
      }
    }
  }
}

if (propagation && actions) {
  const actionIds = new Set(
    (actions.actions ?? []).map((a) => a.id).filter(Boolean),
  );
  for (const rule of propagation.rules ?? []) {
    for (const target of rule.propagate ?? []) {
      if (target === "audit-loop" && actionIds.size === 0) {
        fail("action-catalog must list actions when audit-loop propagation is used");
      }
    }
  }
}

if (failed) process.exit(1);
console.log("governance policies check OK");
