/** Spec: security-governance/trust/key-management.ts */
import { DaemonError, ErrorCodes } from "@daemon/platform-types";

export type KeyState = "active" | "rotating" | "revoked";

export interface ManagedKey {
  id: string;
  material: string;
  state: KeyState;
  createdAt: number;
  rotatedAt?: number;
}

/**
 * In-memory key registry modelling rotation and revocation. A single key per
 * purpose is "active" at a time; rotation supersedes the previous active key
 * and marks it "rotating" until explicitly retired.
 */
export class KeyManagement {
  private readonly keys = new Map<string, ManagedKey>();
  private activeId?: string;

  constructor(private readonly now: () => number = () => Date.now()) {}

  register(id: string, material: string): ManagedKey {
    if (!id || !material) {
      throw new DaemonError(ErrorCodes.VALIDATION, "id and material required", 400);
    }
    if (this.keys.has(id)) {
      throw new DaemonError(ErrorCodes.CONFLICT, `key ${id} exists`, 409);
    }
    const key: ManagedKey = {
      id,
      material,
      state: this.activeId ? "rotating" : "active",
      createdAt: this.now(),
    };
    this.keys.set(id, key);
    if (!this.activeId) this.activeId = id;
    return key;
  }

  /** Promote a registered key to active, demoting the previous active key. */
  rotateTo(id: string): ManagedKey {
    const next = this.keys.get(id);
    if (!next) throw new DaemonError(ErrorCodes.NOT_FOUND, `key ${id} missing`, 404);
    if (next.state === "revoked") {
      throw new DaemonError(ErrorCodes.CONFLICT, "cannot activate revoked key", 409);
    }
    if (this.activeId && this.activeId !== id) {
      const prev = this.keys.get(this.activeId);
      if (prev) prev.state = "rotating";
    }
    next.state = "active";
    next.rotatedAt = this.now();
    this.activeId = id;
    return next;
  }

  revoke(id: string): void {
    const key = this.keys.get(id);
    if (!key) throw new DaemonError(ErrorCodes.NOT_FOUND, `key ${id} missing`, 404);
    key.state = "revoked";
    if (this.activeId === id) this.activeId = undefined;
  }

  active(): ManagedKey {
    const key = this.activeId ? this.keys.get(this.activeId) : undefined;
    if (!key) throw new DaemonError(ErrorCodes.NOT_FOUND, "no active key", 404);
    return key;
  }
}
