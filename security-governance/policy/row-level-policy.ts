/** Spec: security-governance/policy/row-level-policy.ts */
export interface RowContext {
  tenantId: string;
  subjectId: string;
  roles: string[];
}

export interface RowLevelOptions {
  /** Field on each row carrying the owning tenant. Default: "tenantId". */
  tenantField?: string;
  /** Field on each row carrying the owner subject. Default: "ownerId". */
  ownerField?: string;
  /** Roles that bypass row filtering entirely (e.g. platform admins). */
  bypassRoles?: string[];
  /** When true, rows are only visible to their owner within the tenant. */
  ownerOnly?: boolean;
}

/**
 * Row-level security. Enforces tenant isolation and optional owner scoping
 * over arbitrary record collections.
 */
export class RowLevelPolicy {
  private readonly tenantField: string;
  private readonly ownerField: string;
  private readonly bypassRoles: Set<string>;
  private readonly ownerOnly: boolean;

  constructor(options: RowLevelOptions = {}) {
    this.tenantField = options.tenantField ?? "tenantId";
    this.ownerField = options.ownerField ?? "ownerId";
    this.bypassRoles = new Set(options.bypassRoles ?? []);
    this.ownerOnly = options.ownerOnly ?? false;
  }

  visible(row: Record<string, unknown>, ctx: RowContext): boolean {
    if (ctx.roles.some((role) => this.bypassRoles.has(role))) return true;
    if (row[this.tenantField] !== ctx.tenantId) return false;
    if (this.ownerOnly && row[this.ownerField] !== ctx.subjectId) return false;
    return true;
  }

  filter<T extends Record<string, unknown>>(rows: T[], ctx: RowContext): T[] {
    return rows.filter((row) => this.visible(row, ctx));
  }
}
