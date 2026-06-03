/** Spec: security-governance/identity/federation.ts */
import { DaemonError, ErrorCodes } from "@daemon/platform-types";
import type { Principal } from "./authn.js";

export interface IdentityProvider {
  /** Stable issuer identifier, e.g. "okta", "google". */
  issuer: string;
  /** Maps an external claim set into local roles. */
  roleMap: Record<string, string[]>;
}

export interface ExternalAssertion {
  issuer: string;
  subject: string;
  tenantId: string;
  /** Provider-native groups/claims to translate into local roles. */
  groups: string[];
}

/**
 * Identity federation broker. Translates assertions from registered external
 * identity providers into local {@link Principal}s with mapped roles.
 */
export class FederationBroker {
  private readonly providers = new Map<string, IdentityProvider>();

  register(provider: IdentityProvider): void {
    if (!provider.issuer) {
      throw new DaemonError(ErrorCodes.VALIDATION, "issuer is required", 400);
    }
    this.providers.set(provider.issuer, provider);
  }

  exchange(assertion: ExternalAssertion): Principal {
    const provider = this.providers.get(assertion.issuer);
    if (!provider) {
      throw new DaemonError(
        ErrorCodes.UNAUTHORIZED,
        `unknown issuer ${assertion.issuer}`,
        401,
      );
    }
    const roles = new Set<string>();
    for (const group of assertion.groups) {
      for (const role of provider.roleMap[group] ?? []) roles.add(role);
    }
    if (roles.size === 0) {
      throw new DaemonError(
        ErrorCodes.POLICY_DENIED,
        "no local roles mapped from assertion",
        403,
      );
    }
    return {
      subjectId: assertion.subject,
      tenantId: assertion.tenantId,
      roles: [...roles],
    };
  }
}
