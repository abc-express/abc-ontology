/** Spec: security-governance/identity/authn.ts */
import { DaemonError, ErrorCodes } from "@daemon/platform-types";

export interface Principal {
  subjectId: string;
  tenantId: string;
  roles: string[];
}

export type CredentialScheme = "apiKey" | "bearer";

export interface Credential {
  scheme: CredentialScheme;
  value: string;
}

/**
 * Credential authenticator for development and integration use. Resolves API
 * keys and signed-prefix bearer tokens to a {@link Principal}. Production
 * deployments substitute a real OIDC backend behind the same interface.
 */
export class Authenticator {
  private readonly apiKeys = new Map<string, Principal>();

  registerApiKey(key: string, principal: Principal): void {
    if (!key) throw new DaemonError(ErrorCodes.VALIDATION, "api key required", 400);
    this.apiKeys.set(key, principal);
  }

  authenticate(credential: Credential): Principal {
    if (credential.scheme === "apiKey") {
      const principal = this.apiKeys.get(credential.value);
      if (!principal) {
        throw new DaemonError(ErrorCodes.UNAUTHORIZED, "unknown api key", 401);
      }
      return principal;
    }
    if (credential.scheme === "bearer") {
      return this.decodeBearer(credential.value);
    }
    throw new DaemonError(ErrorCodes.UNAUTHORIZED, "unsupported scheme", 401);
  }

  /**
   * Dev bearer format: "sub:tenant:role1,role2". Not a substitute for signed
   * JWT verification, but deterministic and dependency-free for tests.
   */
  private decodeBearer(token: string): Principal {
    const parts = token.split(":");
    if (parts.length !== 3 || !parts[0] || !parts[1]) {
      throw new DaemonError(ErrorCodes.UNAUTHORIZED, "malformed bearer token", 401);
    }
    const roles = parts[2] ? parts[2].split(",").filter(Boolean) : [];
    return { subjectId: parts[0], tenantId: parts[1], roles };
  }
}
