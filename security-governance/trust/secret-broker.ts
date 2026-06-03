/** Spec: security-governance/trust/secret-broker.ts */
import { DaemonError, ErrorCodes } from "@daemon/platform-types";

export interface SecretLease {
  ref: string;
  value: string;
  expiresAt: number;
}

/**
 * Brokers short-lived access to stored secrets. Secrets are stored opaquely
 * and only handed out as time-boxed leases; expired leases are rejected so
 * callers must re-request. Values are never returned by listing operations.
 */
export class SecretBroker {
  private readonly secrets = new Map<string, string>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  put(ref: string, value: string): void {
    if (!ref) throw new DaemonError(ErrorCodes.VALIDATION, "ref required", 400);
    this.secrets.set(ref, value);
  }

  /** Issue a lease valid for `ttlMs` milliseconds. */
  lease(ref: string, ttlMs: number): SecretLease {
    if (ttlMs <= 0) {
      throw new DaemonError(ErrorCodes.VALIDATION, "ttl must be positive", 400);
    }
    const value = this.secrets.get(ref);
    if (value === undefined) {
      throw new DaemonError(ErrorCodes.NOT_FOUND, `secret ${ref} missing`, 404);
    }
    return { ref, value, expiresAt: this.now() + ttlMs };
  }

  /** Validate a previously issued lease against the current clock. */
  isValid(lease: SecretLease): boolean {
    return lease.expiresAt > this.now() && this.secrets.has(lease.ref);
  }

  /** Reference names only — never the secret values. */
  refs(): string[] {
    return [...this.secrets.keys()].sort();
  }
}
