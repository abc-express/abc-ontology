/** Spec: security-governance/policy/field-level-policy.ts */
export interface FieldRule {
  /** Field name to protect. */
  field: string;
  /** Minimum clearance level required to read the raw value. */
  minClearance: number;
  /** Replacement token when masked. Default: "***". */
  mask?: string;
}

/**
 * Field-level data protection. Masks individual fields on a record when the
 * caller's clearance is below the field's configured threshold.
 */
export class FieldLevelPolicy {
  private readonly rules = new Map<string, FieldRule>();

  constructor(rules: FieldRule[] = []) {
    for (const rule of rules) this.rules.set(rule.field, rule);
  }

  apply<T extends Record<string, unknown>>(record: T, clearance: number): T {
    const out: Record<string, unknown> = { ...record };
    for (const [field, rule] of this.rules) {
      if (field in out && clearance < rule.minClearance) {
        out[field] = rule.mask ?? "***";
      }
    }
    return out as T;
  }

  applyMany<T extends Record<string, unknown>>(records: T[], clearance: number): T[] {
    return records.map((record) => this.apply(record, clearance));
  }
}
