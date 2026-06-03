/** Spec: security-governance/guardrails/external-write-guard.ts */
import { type PolicyDecision } from "@daemon/platform-types";

export interface ExternalWrite {
  /** Target external system id, e.g. "salesforce", "sap". */
  system: string;
  /** Logical operation, e.g. "create", "update", "delete". */
  operation: string;
  /** Approximate number of records affected. */
  recordCount: number;
}

export interface ExternalWritePolicy {
  /** Systems writes may target at all. */
  allowedSystems: string[];
  /** Operations that always require human approval. */
  approvalRequired: string[];
  /** Reject batches larger than this without approval. */
  maxAutoRecords: number;
}

/**
 * Gates outbound writes to third-party systems. Writes to unknown systems are
 * always denied; destructive or large operations require an explicit approval
 * token. This is the last checkpoint before {@link ExternalWrite}s leave the
 * platform boundary.
 */
export class ExternalWriteGuard {
  constructor(private readonly policy: ExternalWritePolicy) {}

  evaluate(write: ExternalWrite, approved = false): PolicyDecision {
    if (!this.policy.allowedSystems.includes(write.system)) {
      return { effect: "deny", reason: `system ${write.system} not allowed` };
    }
    const needsApproval =
      this.policy.approvalRequired.includes(write.operation) ||
      write.recordCount > this.policy.maxAutoRecords;
    if (needsApproval && !approved) {
      return {
        effect: "deny",
        reason: "operation requires approval",
        obligations: ["human-approval"],
      };
    }
    return { effect: "allow", reason: "external write permitted" };
  }
}
