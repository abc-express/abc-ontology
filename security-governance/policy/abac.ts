/** Spec: security-governance/policy/abac.ts */
import { DaemonError, ErrorCodes, type PolicyDecision } from "@daemon/platform-types";

export type AttributeValue = string | number | boolean;
export type AttributeMap = Record<string, AttributeValue>;

export interface AbacRequest {
  subject: AttributeMap;
  resource: AttributeMap;
  action: string;
  environment?: AttributeMap;
}

export type AbacOperator = "eq" | "ne" | "in" | "gte" | "lte";

export interface AbacCondition {
  /** Dotted path into the request: subject.role, resource.tenantId, environment.mfa. */
  attribute: string;
  operator: AbacOperator;
  value: AttributeValue | Array<string | number>;
}

export interface AbacRule {
  id: string;
  action: string | "*";
  effect: "allow" | "deny";
  /** Every condition must hold for the rule to apply. */
  match: AbacCondition[];
}

/**
 * Attribute-based access control. Rules are evaluated against subject,
 * resource, action, and environment attributes. Explicit deny wins over
 * allow, and the default decision is deny.
 */
export class Abac {
  private readonly rules: AbacRule[] = [];

  constructor(rules: AbacRule[] = []) {
    for (const rule of rules) this.add(rule);
  }

  add(rule: AbacRule): void {
    if (!rule.id) {
      throw new DaemonError(ErrorCodes.VALIDATION, "rule id is required", 400);
    }
    this.rules.push(rule);
  }

  evaluate(request: AbacRequest): PolicyDecision {
    const applicable = this.rules.filter(
      (rule) =>
        (rule.action === "*" || rule.action === request.action) &&
        rule.match.every((cond) => this.matches(cond, request)),
    );

    const deny = applicable.find((rule) => rule.effect === "deny");
    if (deny) {
      return { effect: "deny", reason: `denied by ${deny.id}` };
    }
    const allow = applicable.find((rule) => rule.effect === "allow");
    if (allow) {
      return { effect: "allow", reason: `allowed by ${allow.id}` };
    }
    return { effect: "deny", reason: "no matching rule" };
  }

  private matches(cond: AbacCondition, request: AbacRequest): boolean {
    const actual = this.resolve(cond.attribute, request);
    switch (cond.operator) {
      case "eq":
        return actual === cond.value;
      case "ne":
        return actual !== cond.value;
      case "in":
        return Array.isArray(cond.value) && cond.value.some((v) => v === actual);
      case "gte":
        return (
          typeof actual === "number" &&
          typeof cond.value === "number" &&
          actual >= cond.value
        );
      case "lte":
        return (
          typeof actual === "number" &&
          typeof cond.value === "number" &&
          actual <= cond.value
        );
      default:
        return false;
    }
  }

  private resolve(path: string, request: AbacRequest): AttributeValue | undefined {
    const [scope, key] = path.split(".", 2);
    if (!key) return undefined;
    const bag =
      scope === "subject"
        ? request.subject
        : scope === "resource"
          ? request.resource
          : scope === "environment"
            ? request.environment
            : undefined;
    return bag?.[key];
  }
}
