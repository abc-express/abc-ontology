/** Spec: security-governance/guardrails/action-guard.ts */
import { DaemonError, ErrorCodes, type PolicyDecision } from "@daemon/platform-types";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface ActionRequest {
  action: string;
  risk: RiskLevel;
  /** Approvals already collected for this action. */
  approvals: string[];
}

const RISK_ORDER: Record<RiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export interface ActionGuardConfig {
  /** Risk level at or above which approvals are mandatory. */
  approvalThreshold: RiskLevel;
  /** Number of distinct approvals required at/above the threshold. */
  requiredApprovals: number;
  /** Actions that are always blocked outright. */
  denylist: string[];
}

/**
 * Gates execution of runtime actions by risk. Denylisted actions are blocked
 * unconditionally; actions at or above the configured risk threshold require a
 * quorum of distinct approvals before they may proceed.
 */
export class ActionGuard {
  constructor(private readonly config: ActionGuardConfig) {}

  evaluate(request: ActionRequest): PolicyDecision {
    if (this.config.denylist.includes(request.action)) {
      return { effect: "deny", reason: `action ${request.action} is denylisted` };
    }
    const needsApproval =
      RISK_ORDER[request.risk] >= RISK_ORDER[this.config.approvalThreshold];
    if (needsApproval) {
      const distinct = new Set(request.approvals).size;
      if (distinct < this.config.requiredApprovals) {
        return {
          effect: "deny",
          reason: `needs ${this.config.requiredApprovals} approvals, have ${distinct}`,
          obligations: ["collect-approvals"],
        };
      }
    }
    return { effect: "allow", reason: "action permitted" };
  }

  assert(request: ActionRequest): void {
    const decision = this.evaluate(request);
    if (decision.effect === "deny") {
      throw new DaemonError(ErrorCodes.POLICY_DENIED, decision.reason ?? "denied", 403);
    }
  }
}
