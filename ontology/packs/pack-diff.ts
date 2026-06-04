import { EntityModel, type FieldSpec } from "../models/entities/entity-model.js";
import type { SchemaChangeType } from "../governance/governance-policy-loader.js";
import type { LoadedOntologyPack } from "./load-pack.js";
import { assertValidExtensionPackId } from "./extension-pack-id.js";
import {
  loadFoundationPack,
  loadExtensionPack,
  loadPackFromDirectory,
  foundationPackRoot,
  extensionPackRoot,
} from "./load-pack.js";
import { join } from "node:path";

export interface PackDiffEntry {
  changeType: SchemaChangeType;
  entityType?: string;
  relationType?: string;
  junctionType?: string;
  field?: string;
  detail?: string;
}

export interface PackDiffSummary {
  changes: PackDiffEntry[];
  breaking: boolean;
  semverBump: "major" | "minor" | "patch";
}

function fieldMap(model: { fields(): FieldSpec[] }): Map<string, FieldSpec> {
  return new Map(model.fields().map((f) => [f.name, f]));
}

function compareEntityModels(
  entityType: string,
  baseline: LoadedOntologyPack,
  proposed: LoadedOntologyPack,
  changes: PackDiffEntry[],
): void {
  const baseModel = baseline.models.get(entityType);
  const propModel = proposed.models.get(entityType);
  if (!baseModel && propModel) {
    changes.push({
      changeType: "field_add",
      entityType,
      detail: `entity type ${entityType} added`,
    });
    return;
  }
  if (baseModel && !propModel) {
    changes.push({
      changeType: "field_remove",
      entityType,
      detail: `entity type ${entityType} removed`,
    });
    return;
  }
  if (!baseModel || !propModel) return;

  const baseFields = fieldMap(baseModel);
  const propFields = fieldMap(propModel);

  for (const [name, spec] of baseFields) {
    if (!propFields.has(name)) {
      changes.push({
        changeType: "field_remove",
        entityType,
        field: name,
        detail: spec.required ? `required field ${name} removed` : `field ${name} removed`,
      });
    }
  }
  for (const [name, spec] of propFields) {
    const base = baseFields.get(name);
    if (!base) {
      changes.push({
        changeType: "field_add",
        entityType,
        field: name,
        detail: spec.required
          ? `required field ${name} added`
          : `optional field ${name} added`,
      });
      continue;
    }
    if (base.type !== spec.type) {
      changes.push({
        changeType: "type_rename",
        entityType,
        field: name,
        detail: `${base.type} -> ${spec.type}`,
      });
    } else if (!base.required && spec.required) {
      changes.push({
        changeType: "field_add",
        entityType,
        field: name,
        detail: `field ${name} now required`,
      });
    }
  }
}

function compareTypeLists(
  changeAdd: SchemaChangeType,
  changeRemove: SchemaChangeType,
  baseline: string[],
  proposed: string[],
  key: "relationType" | "junctionType",
  changes: PackDiffEntry[],
): void {
  const baseSet = new Set(baseline);
  const propSet = new Set(proposed);
  for (const name of propSet) {
    if (!baseSet.has(name)) {
      changes.push({ changeType: changeAdd, [key]: name, detail: `${name} added` });
    }
  }
  for (const name of baseSet) {
    if (!propSet.has(name)) {
      changes.push({
        changeType: changeRemove,
        [key]: name,
        detail: `${name} removed`,
      });
    }
  }
}

export function diffPacks(
  baseline: LoadedOntologyPack,
  proposed: LoadedOntologyPack,
): PackDiffSummary {
  const changes: PackDiffEntry[] = [];
  const entityTypes = new Set([
    ...baseline.manifest.entityTypes,
    ...proposed.manifest.entityTypes,
  ]);
  for (const entityType of entityTypes) {
    compareEntityModels(entityType, baseline, proposed, changes);
  }

  compareTypeLists(
    "relation_add",
    "relation_remove",
    baseline.manifest.relationTypes ?? [],
    proposed.manifest.relationTypes ?? [],
    "relationType",
    changes,
  );
  compareTypeLists(
    "junction_add",
    "junction_remove",
    baseline.manifest.junctionTypes ?? [],
    proposed.manifest.junctionTypes ?? [],
    "junctionType",
    changes,
  );

  const breaking = changes.some((c) =>
    ["field_remove", "type_rename", "relation_remove", "junction_remove"].includes(
      c.changeType,
    ),
  );
  const semverBump: PackDiffSummary["semverBump"] = breaking
    ? "major"
    : changes.length > 0
      ? "minor"
      : "patch";
  return { changes, breaking, semverBump };
}

export function loadBaselinePack(packId: string): LoadedOntologyPack {
  if (packId === "foundation") {
    return loadFoundationPack();
  }
  assertValidExtensionPackId(packId);
  return loadExtensionPack(packId);
}

export interface ProposedPackOverrides {
  entities?: Record<
    string,
    { fields: { name: string; type: string; required?: boolean }[] }
  >;
}

export function buildProposedPackFromOverrides(
  baseline: LoadedOntologyPack,
  overrides: ProposedPackOverrides,
): LoadedOntologyPack {
  const models = new Map(baseline.models);
  for (const [entityType, def] of Object.entries(overrides.entities ?? {})) {
    models.set(
      entityType,
      new EntityModel({
        ontologyId: baseline.manifest.ontologyId,
        fields: def.fields as FieldSpec[],
      }),
    );
  }
  return { ...baseline, models };
}

export function loadProposedPack(input: {
  packId: string;
  proposedPackDir?: string;
  proposedOverrides?: ProposedPackOverrides;
}): LoadedOntologyPack {
  if (input.proposedPackDir) {
    return loadPackFromDirectory(input.proposedPackDir);
  }
  const baseline = loadBaselinePack(input.packId);
  if (input.proposedOverrides) {
    return buildProposedPackFromOverrides(baseline, input.proposedOverrides);
  }
  throw new Error("proposedPackDir or proposedOverrides required");
}

export function diffPackChange(input: {
  packId: string;
  proposedPackDir?: string;
  proposedOverrides?: ProposedPackOverrides;
}): PackDiffSummary {
  const baseline = loadBaselinePack(input.packId);
  const proposed = loadProposedPack(input);
  return diffPacks(baseline, proposed);
}

/** Load proposed pack from a directory under configs/ontology/packs/... */
export function resolveProposedPackDir(packId: string, relativeDir?: string): string {
  if (relativeDir) {
    if (relativeDir.startsWith("/")) return relativeDir;
    return join(foundationPackRoot(), "..", relativeDir);
  }
  if (packId === "foundation") return foundationPackRoot();
  return extensionPackRoot(packId);
}
