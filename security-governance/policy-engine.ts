import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import type { PolicyDecision } from "@daemon/platform-types";

export type PolicyRule = {
  action: string;
  resource: string;
  effect: "allow" | "deny";
};

export class PolicyEngine {
  constructor(private readonly rules: PolicyRule[]) {}

  static fromRules(rules: PolicyRule[]): PolicyEngine {
    return new PolicyEngine(rules);
  }

  static async loadFile(path: string): Promise<PolicyEngine> {
    const raw = await readFile(path, "utf8");
    const parsed = parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error("policy file must be a YAML list of rules");
    }
    const rules = parsed.map((row) => {
      const r = row as Record<string, unknown>;
      if (
        typeof r.action !== "string" ||
        typeof r.resource !== "string" ||
        (r.effect !== "allow" && r.effect !== "deny")
      ) {
        throw new Error("invalid policy rule shape");
      }
      return {
        action: r.action,
        resource: r.resource,
        effect: r.effect,
      } satisfies PolicyRule;
    });
    return new PolicyEngine(rules);
  }

  evaluate(action: string, resource: string): PolicyDecision {
    for (const rule of this.rules) {
      if (rule.action === action && rule.resource === resource) {
        return {
          effect: rule.effect,
          reason: `matched rule ${action}:${resource}`,
        };
      }
    }
    return { effect: "deny", reason: "no matching rule" };
  }
}
