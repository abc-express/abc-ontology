import { DaemonError, ErrorCodes } from "@daemon/platform-types";

export type Constraint = (value: Record<string, unknown>) => string | null;

export interface ConstraintResult {
  valid: boolean;
  violations: string[];
}

/**
 * Evaluates a set of named constraints against a record. Each constraint
 * returns a violation message or null when satisfied.
 */
export class ConstraintEngine {
  private readonly constraints = new Map<string, Constraint>();

  define(name: string, constraint: Constraint): void {
    if (!name) throw new Error("constraint name required");
    this.constraints.set(name, constraint);
  }

  check(value: Record<string, unknown>): ConstraintResult {
    const violations: string[] = [];
    for (const [name, constraint] of this.constraints) {
      const message = constraint(value);
      if (message) violations.push(`${name}: ${message}`);
    }
    return { valid: violations.length === 0, violations };
  }

  assert(value: Record<string, unknown>): void {
    const result = this.check(value);
    if (!result.valid) {
      throw new DaemonError(
        ErrorCodes.VALIDATION,
        `constraint violations: ${result.violations.join("; ")}`,
        400,
      );
    }
  }
}

export function required(field: string): Constraint {
  return (value) =>
    value[field] === undefined || value[field] === null
      ? `missing required field "${field}"`
      : null;
}

export function range(field: string, min: number, max: number): Constraint {
  return (value) => {
    const n = value[field];
    if (typeof n !== "number") return `"${field}" must be a number`;
    if (n < min || n > max) return `"${field}" out of range [${min}, ${max}]`;
    return null;
  };
}
