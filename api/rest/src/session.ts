import type { DaemonSession, SessionId } from "@daemon/platform-types";

/**
 * Resolves a {@link DaemonSession} for the REST surface.
 *
 * The standalone REST app is a thin deployment of the same read/write loops
 * the gateway exposes. It does not run the gateway's Nest guards, so it
 * derives a session from request headers directly:
 *
 * - `x-daemon-session` — opaque session id minted upstream
 * - `x-api-key`        — service credential (subject = the key id)
 * - otherwise          — an anonymous dev session (local only)
 *
 * Production deployments front this app with the gateway (which performs real
 * authentication); the dev fallback keeps the app runnable in isolation.
 */
export function resolveSession(headers: Record<string, string | string[] | undefined>): DaemonSession {
  const sessionHeader = first(headers["x-daemon-session"]);
  const apiKey = first(headers["x-api-key"]);
  const tenant = first(headers["x-daemon-tenant"]) ?? "dev-tenant";

  if (sessionHeader) {
    return {
      sessionId: sessionHeader as SessionId,
      subjectId: sessionHeader,
      tenantId: tenant,
      roles: ["reader", "writer"],
      issuedAt: new Date().toISOString(),
    };
  }

  if (apiKey) {
    return {
      sessionId: `apikey-${apiKey.slice(0, 8)}` as SessionId,
      subjectId: `apikey:${apiKey.slice(0, 8)}`,
      tenantId: tenant,
      roles: ["service"],
      issuedAt: new Date().toISOString(),
    };
  }

  return {
    sessionId: "dev-session" as SessionId,
    subjectId: "anonymous",
    tenantId: tenant,
    roles: ["reader", "writer"],
    issuedAt: new Date().toISOString(),
  };
}

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}
