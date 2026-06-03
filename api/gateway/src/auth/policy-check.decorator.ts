import { SetMetadata } from "@nestjs/common";

/** Metadata key carrying the {@link PolicyCheckSpec} for a route. */
export const POLICY_CHECK_KEY = "daemon:policy-check";

export interface PolicyCheckSpec {
  action: string;
  resource: string;
}

/**
 * Declares the policy `action`/`resource` pair enforced by {@link PolicyGuard}
 * for a handler. When omitted on a protected route, the guard infers the action
 * from the HTTP verb and defaults the resource to `entity`.
 */
export const PolicyCheck = (action: string, resource: string) =>
  SetMetadata(POLICY_CHECK_KEY, { action, resource } satisfies PolicyCheckSpec);
