import type { PolicyDecision } from "@daemon/platform-types";
import { DaemonError, ErrorCodes } from "@daemon/platform-types";
import { ReadRouter } from "@daemon/read-write-loops/reads/read-router.js";
import { CommandGateway } from "@daemon/read-write-loops/writes/command-gateway.js";
import { LoopOrchestrator } from "@daemon/read-write-loops/loop-controller/loop-orchestrator.js";
import {
  PolicyEngine,
  type PolicyRule,
} from "@daemon/security-governance/policy-engine.js";
import { PromptGuard } from "@daemon/security-governance/guardrails/prompt-guard.js";

export const DEFAULT_PRODUCT_POLICY_RULES: PolicyRule[] = [
  { action: "read", resource: "entity", effect: "allow" },
  { action: "write", resource: "entity", effect: "allow" },
  { action: "admin", resource: "ontology", effect: "allow" },
  { action: "query", resource: "analytics", effect: "allow" },
  { action: "chat", resource: "customer-gpt", effect: "allow" },
];

export interface ProductRuntimeOptions {
  policy?: PolicyEngine;
  promptGuard?: PromptGuard;
}

/**
 * Shared wiring for product surfaces: ontology reads/writes, policy, prompt
 * guardrails, and the read–write loop used by automations.
 */
export class ProductRuntime {
  readonly reads = new ReadRouter();
  readonly writes = new CommandGateway();
  readonly policy: PolicyEngine;
  readonly promptGuard: PromptGuard;

  constructor(options: ProductRuntimeOptions = {}) {
    this.policy =
      options.policy ?? PolicyEngine.fromRules(DEFAULT_PRODUCT_POLICY_RULES);
    this.promptGuard = options.promptGuard ?? new PromptGuard();
  }

  createLoop(): LoopOrchestrator {
    const policyPort = {
      evaluate: (action: string, resource: string): PolicyDecision => {
        if (action === "write" && resource.includes("/")) {
          return this.policy.evaluate("write", "entity");
        }
        return this.policy.evaluate(action, resource);
      },
    };
    return new LoopOrchestrator(this.reads, policyPort, this.writes);
  }

  assertAllowed(action: string, resource: string): PolicyDecision {
    const decision = this.policy.evaluate(action, resource);
    if (decision.effect === "deny") {
      throw new DaemonError(
        ErrorCodes.POLICY_DENIED,
        decision.reason ?? `denied ${action} on ${resource}`,
        403,
      );
    }
    return decision;
  }
}
