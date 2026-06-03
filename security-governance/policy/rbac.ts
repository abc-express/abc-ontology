/** Spec: security-governance/policy/rbac.ts */
import { DaemonError, ErrorCodes } from "@daemon/platform-types";

export interface RoleDefinition {
  role: string;
  permissions: string[];
  inherits?: string[];
}

/**
 * Role-based access control. Roles grant permissions and may inherit
 * permissions from other roles. A permission of "*" grants everything.
 */
export class Rbac {
  private readonly roles = new Map<string, RoleDefinition>();

  define(definition: RoleDefinition): void {
    if (!definition.role) {
      throw new DaemonError(ErrorCodes.VALIDATION, "role name is required", 400);
    }
    this.roles.set(definition.role, definition);
  }

  /** Resolve the full permission set for a role, following inheritance. */
  permissionsFor(role: string): Set<string> {
    const collected = new Set<string>();
    const visited = new Set<string>();
    const walk = (name: string): void => {
      if (visited.has(name)) return;
      visited.add(name);
      const def = this.roles.get(name);
      if (!def) return;
      for (const perm of def.permissions) collected.add(perm);
      for (const parent of def.inherits ?? []) walk(parent);
    };
    walk(role);
    return collected;
  }

  /** True when any of the subject's roles grants the permission. */
  can(roles: string[], permission: string): boolean {
    for (const role of roles) {
      const perms = this.permissionsFor(role);
      if (perms.has("*") || perms.has(permission)) return true;
    }
    return false;
  }

  assert(roles: string[], permission: string): void {
    if (!this.can(roles, permission)) {
      throw new DaemonError(
        ErrorCodes.POLICY_DENIED,
        `missing permission ${permission}`,
        403,
      );
    }
  }
}
