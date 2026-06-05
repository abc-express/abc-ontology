import type { PolicyDecision } from "@daemon/platform-types";
import { DaemonError, ErrorCodes } from "@daemon/platform-types";
import type { OntologyScope, OntologyStore } from "@daemon/context-ports";
import { globalRegistry } from "@daemon/ontology";
import { ReadRouter } from "@daemon/read-write-loops/reads/read-router.js";
import { CommandGateway } from "@daemon/read-write-loops/writes/command-gateway.js";
import { LoopOrchestrator } from "@daemon/read-write-loops/loop-controller/loop-orchestrator.js";
import {
  PolicyEngine,
  type PolicyRule,
} from "@daemon/security-governance/policy-engine.js";
import { PromptGuard } from "@daemon/security-governance/guardrails/prompt-guard.js";
import type { ScopedOntologySearch } from "@daemon/ontology/search/scoped-ontology-search.js";

export const DEFAULT_PRODUCT_POLICY_RULES: PolicyRule[] = [
  { action: "read", resource: "entity", effect: "allow" },
  { action: "write", resource: "entity", effect: "allow" },
  { action: "admin", resource: "ontology", effect: "allow" },
  { action: "query", resource: "analytics", effect: "allow" },
  { action: "chat", resource: "customer-gpt", effect: "allow" },
  { action: "chat", resource: "agent-worker", effect: "allow" },
];

export interface ProductRuntimeOptions {
  policy?: PolicyEngine;
  promptGuard?: PromptGuard;
  reads?: ReadRouter;
  writes?: CommandGateway;
  store?: OntologyStore;
  scope?: OntologyScope;
  search?: ScopedOntologySearch;
}

/**
 * Shared wiring for product surfaces: ontology reads/writes, policy, prompt
 * guardrails, and the read–write loop used by automations.
 */
export class ProductRuntime {
  readonly reads: ReadRouter;
  readonly writes: CommandGateway;
  readonly store: OntologyStore;
  readonly scope?: OntologyScope;
  readonly search?: ScopedOntologySearch;
  readonly policy: PolicyEngine;
  readonly promptGuard: PromptGuard;

  constructor(options: ProductRuntimeOptions = {}) {
    this.store = options.store ?? globalRegistry;
    this.reads = options.reads ?? new ReadRouter(this.store);
    this.writes = options.writes ?? new CommandGateway(this.store);
    this.scope = options.scope;
    this.search = options.search;
    this.policy =
      options.policy ?? PolicyEngine.fromRules(DEFAULT_PRODUCT_POLICY_RULES);
    this.promptGuard = options.promptGuard ?? new PromptGuard();
  }

  /** Gateway-scoped runtime: tenant store, hybrid search, shared policy. */
  static fromGatewayBridge(options: {
    reads: ReadRouter;
    writes: CommandGateway;
    store: OntologyStore;
    policy: PolicyEngine;
    search: ScopedOntologySearch;
    scope: OntologyScope;
    promptGuard?: PromptGuard;
  }): ProductRuntime {
    return new ProductRuntime({
      reads: options.reads,
      writes: options.writes,
      store: options.store,
      policy: options.policy,
      search: options.search,
      scope: options.scope,
      promptGuard: options.promptGuard,
    });
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
