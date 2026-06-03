import { DaemonError, ErrorCodes } from "@daemon/platform-types";
import type { FieldSpec } from "../entities/entity-model.js";

/**
 * A trait is a reusable bundle of fields that can be composed onto entities
 * (for example `timestamped` adds createdAt/updatedAt). Traits let multiple
 * entity models share field definitions without duplication.
 */
export interface TraitDefinition {
  name: string;
  fields: FieldSpec[];
}

export class TraitModel {
  private readonly fieldMap: Map<string, FieldSpec>;

  constructor(private readonly def: TraitDefinition) {
    if (!def.name.trim()) {
      throw new DaemonError(ErrorCodes.VALIDATION, "trait name required", 400);
    }
    this.fieldMap = new Map();
    for (const f of def.fields) {
      if (this.fieldMap.has(f.name)) {
        throw new DaemonError(
          ErrorCodes.CONFLICT,
          `duplicate trait field: ${f.name}`,
          409,
        );
      }
      this.fieldMap.set(f.name, f);
    }
  }

  get name(): string {
    return this.def.name;
  }

  get fields(): FieldSpec[] {
    return [...this.fieldMap.values()];
  }

  /**
   * Merges this trait's fields with a base field list. Conflicting field names
   * with incompatible types raise an error; identical specs are deduplicated.
   */
  applyTo(base: FieldSpec[]): FieldSpec[] {
    const merged = new Map<string, FieldSpec>();
    for (const f of base) merged.set(f.name, f);
    for (const f of this.fieldMap.values()) {
      const existing = merged.get(f.name);
      if (existing && existing.type !== f.type) {
        throw new DaemonError(
          ErrorCodes.CONFLICT,
          `trait ${this.def.name} field ${f.name} conflicts with base type ${existing.type}`,
          409,
        );
      }
      merged.set(f.name, f);
    }
    return [...merged.values()];
  }
}

/** Composes multiple traits left-to-right onto a base field set. */
export function composeTraits(
  base: FieldSpec[],
  traits: TraitModel[],
): FieldSpec[] {
  return traits.reduce((acc, trait) => trait.applyTo(acc), base);
}
