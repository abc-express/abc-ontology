export interface ApprovalRule {
  /** Property key inspected on the write patch. */
  field: string;
  /** Numeric threshold above which approval is required. */
  threshold: number;
}

export interface ApprovalRequest {
  patch: Record<string, unknown>;
  approvals: string[];
}

export interface ApprovalDecision {
  requiresApproval: boolean;
  approved: boolean;
  reasons: string[];
}

/**
 * Evaluates whether a write requires human approval based on value thresholds,
 * and whether sufficient approvals are present to proceed.
 */
export class ApprovalGates {
  constructor(
    private readonly rules: ApprovalRule[] = [],
    private readonly minApprovals = 1,
  ) {}

  evaluate(req: ApprovalRequest): ApprovalDecision {
    const reasons: string[] = [];

    for (const rule of this.rules) {
      const value = req.patch[rule.field];
      if (typeof value === "number" && value > rule.threshold) {
        reasons.push(
          `${rule.field}=${value} exceeds threshold ${rule.threshold}`,
        );
      }
    }

    const requiresApproval = reasons.length > 0;
    const approved = !requiresApproval || req.approvals.length >= this.minApprovals;

    return { requiresApproval, approved, reasons };
  }
}
