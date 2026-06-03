export type EscalationLevel = "none" | "notify" | "page" | "halt";

export interface EscalationInput {
  failureCount: number;
  conflict?: boolean;
  policyDenied?: boolean;
}

/**
 * Maps loop failure signals to an escalation level. Deterministic so callers
 * can route to the right responder (log, on-call page, or hard halt).
 */
export class EscalationEngine {
  constructor(
    private readonly pageThreshold = 3,
    private readonly haltThreshold = 5,
  ) {}

  assess(input: EscalationInput): EscalationLevel {
    if (input.policyDenied) return "halt";
    if (input.failureCount >= this.haltThreshold) return "halt";
    if (input.failureCount >= this.pageThreshold) return "page";
    if (input.conflict || input.failureCount > 0) return "notify";
    return "none";
  }
}
