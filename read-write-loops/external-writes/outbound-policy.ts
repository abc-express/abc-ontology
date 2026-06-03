export interface OutboundTarget {
  system: string;
  operation: string;
}

export interface OutboundPolicyConfig {
  /** Systems that may receive outbound writes. */
  allowedSystems: string[];
  /** Operations that are blocked regardless of system. */
  deniedOperations?: string[];
}

export interface OutboundDecision {
  allowed: boolean;
  reason: string;
}

/**
 * Authorizes outbound writes to external systems against an allow-list of
 * systems and a deny-list of operations.
 */
export class OutboundPolicy {
  constructor(private readonly config: OutboundPolicyConfig) {}

  authorize(target: OutboundTarget): OutboundDecision {
    if (!this.config.allowedSystems.includes(target.system)) {
      return { allowed: false, reason: `system not allowed: ${target.system}` };
    }
    if (this.config.deniedOperations?.includes(target.operation)) {
      return {
        allowed: false,
        reason: `operation denied: ${target.operation}`,
      };
    }
    return { allowed: true, reason: "ok" };
  }
}
