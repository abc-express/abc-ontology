import { DaemonError, ErrorCodes } from "@daemon/platform-types";

/** Primitive field types supported by ontology model schemas. */
export type FieldType = "string" | "number" | "boolean" | "object" | "array";

export interface FieldSpec {
  name: string;
  type: FieldType;
  required?: boolean;
}

export interface ValidationIssue {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface EntityModelDefinition {
  ontologyId: string;
  fields: FieldSpec[];
}

/** Returns true when `value` conforms to the declared `type`. */
export function matchesType(value: unknown, type: FieldType): boolean {
  switch (type) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "array":
      return Array.isArray(value);
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}

/**
 * A typed entity schema. Validates property bags against declared fields:
 * required fields must be present and every present field must match its type.
 */
export class EntityModel {
  private readonly fieldList: FieldSpec[];

  constructor(private readonly def: EntityModelDefinition) {
    if (!def.ontologyId.trim()) {
      throw new DaemonError(ErrorCodes.VALIDATION, "ontologyId required", 400);
    }
    const seen = new Set<string>();
    for (const f of def.fields) {
      if (!f.name.trim()) {
        throw new DaemonError(ErrorCodes.VALIDATION, "field name required", 400);
      }
      if (seen.has(f.name)) {
        throw new DaemonError(
          ErrorCodes.CONFLICT,
          `duplicate field: ${f.name}`,
          409,
        );
      }
      seen.add(f.name);
    }
    this.fieldList = [...def.fields];
  }

  get ontologyId(): string {
    return this.def.ontologyId;
  }

  fields(): FieldSpec[] {
    return [...this.fieldList];
  }

  validate(props: Record<string, unknown>): ValidationResult {
    const issues: ValidationIssue[] = [];
    for (const field of this.fieldList) {
      const present = Object.prototype.hasOwnProperty.call(props, field.name);
      if (!present) {
        if (field.required) {
          issues.push({ field: field.name, message: "required field missing" });
        }
        continue;
      }
      if (!matchesType(props[field.name], field.type)) {
        issues.push({
          field: field.name,
          message: `expected ${field.type}`,
        });
      }
    }
    return { valid: issues.length === 0, issues };
  }
}
