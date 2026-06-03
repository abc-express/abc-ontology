/** Spec: security-governance/trust/zero-trust-gateway.ts */
import { type PolicyDecision } from "@daemon/platform-types";

export interface AccessContext {
  /** Whether the caller presented a verified identity. */
  authenticated: boolean;
  /** Device posture score 0..1 from an endpoint agent. */
  devicePosture: number;
  /** True when the network path is considered trusted (e.g. mTLS mesh). */
  trustedNetwork: boolean;
  /** Sensitivity tier of the target resource. */
  resourceTier: "public" | "internal" | "restricted";
}

export interface ZeroTrustOptions {
  /** Minimum device posture required for restricted resources. */
  minPostureRestricted: number;
}

/**
 * Per-request zero-trust evaluator. Never trusts the network alone: every
 * request must be authenticated, and access to higher tiers requires stronger
 * device posture. Returns a {@link PolicyDecision} rather than throwing so the
 * gateway can log and shape responses.
 */
export class ZeroTrustGateway {
  constructor(
    private readonly options: ZeroTrustOptions = { minPostureRestricted: 0.8 },
  ) {}

  evaluate(ctx: AccessContext): PolicyDecision {
    if (!ctx.authenticated) {
      return { effect: "deny", reason: "unauthenticated request" };
    }
    if (ctx.resourceTier === "public") {
      return { effect: "allow", reason: "public resource" };
    }
    if (ctx.resourceTier === "internal") {
      return ctx.devicePosture >= 0.5
        ? { effect: "allow", reason: "internal access with adequate posture" }
        : { effect: "deny", reason: "insufficient device posture" };
    }
    // restricted
    if (ctx.devicePosture < this.options.minPostureRestricted) {
      return { effect: "deny", reason: "posture below restricted threshold" };
    }
    if (!ctx.trustedNetwork) {
      return { effect: "deny", reason: "restricted access requires trusted path" };
    }
    return { effect: "allow", reason: "restricted access granted" };
  }
}
