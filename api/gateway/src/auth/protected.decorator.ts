import { SetMetadata } from "@nestjs/common";

/** Metadata key marking a route as requiring authentication + policy checks. */
export const PROTECTED_KEY = "daemon:protected";

/**
 * Marks a controller or handler as protected: the global {@link AuthGuard}
 * requires a valid session and {@link PolicyGuard} enforces an allow decision.
 * Unmarked routes (health, read) stay open in dev but still receive any session
 * that was supplied.
 */
export const Protected = () => SetMetadata(PROTECTED_KEY, true);
