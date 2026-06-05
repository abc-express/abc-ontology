import { DaemonClient, type DaemonClientConfig } from "@daemon/sdk";

function resolveApiKey(): string {
  const configured = import.meta.env.VITE_DAEMON_API_KEY?.trim();
  if (configured) return configured;
  return "";
}

export function daemonClientConfig(
  overrides?: Partial<Pick<DaemonClientConfig, "tenantId" | "domainId">>,
): DaemonClientConfig {
  const apiKey = resolveApiKey();
  if (!apiKey) {
    throw new Error("VITE_DAEMON_API_KEY is required for production console builds");
  }
  return {
    baseUrl: import.meta.env.VITE_DAEMON_API_URL?.trim() || "/api",
    apiKey,
    tenantId:
      overrides?.tenantId ??
      import.meta.env.VITE_DAEMON_TENANT?.trim() ??
      "default",
    domainId:
      overrides?.domainId ??
      import.meta.env.VITE_DAEMON_DOMAIN?.trim() ??
      "foundation",
  };
}

export function createDaemonClient(
  overrides?: Partial<Pick<DaemonClientConfig, "tenantId" | "domainId">>,
): DaemonClient {
  return new DaemonClient(daemonClientConfig(overrides));
}
