/** Spec: security-governance/identity/authz.ts */
import { DaemonError, ErrorCodes, type PolicyDecision } from "@daemon/platform-types";
import type { Rbac } from "../policy/rbac.js";
import type { Abac, AttributeMap } from "../policy/abac.js";
import type { Principal } from "./authn.js";

export interface AuthorizationRequest {
  principal: Principal;
  action: string;
  resource: AttributeMap;
}

/**
 * Authorization service combining role-based and attribute-based checks.
 * RBAC must grant the action; if an ABAC engine is supplied it must not deny.
 */
export class Authorizer {
  constructor(
    private readonly rbac: Rbac,
    private readonly abac?: Abac,
  ) {}

  authorize(request: AuthorizationRequest): PolicyDecision {
    const granted = this.rbac.can(request.principal.roles, request.action);
    if (!granted) {
      return { effect: "deny", reason: "rbac: no role grants action" };
    }
    if (this.abac) {
      const decision = this.abac.evaluate({
        action: request.action,
        subject: {
          subjectId: request.principal.subjectId,
          tenantId: request.principal.tenantId,
        },
        resource: request.resource,
      });
      if (decision.effect === "deny") return decision;
    }
    return { effect: "allow", reason: "rbac+abac granted" };
  }

  assert(request: AuthorizationRequest): void {
    const decision = this.authorize(request);
    if (decision.effect === "deny") {
      throw new DaemonError(
        ErrorCodes.POLICY_DENIED,
        decision.reason ?? "authorization denied",
        403,
      );
    }
  }
}
