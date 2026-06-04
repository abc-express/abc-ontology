import { DaemonClient } from "@daemon/sdk";

export function createDaemonClient(): DaemonClient {
  const baseUrl =
    import.meta.env.VITE_DAEMON_API_URL?.trim() || "/api";
  return new DaemonClient({
    baseUrl,
    apiKey: import.meta.env.VITE_DAEMON_API_KEY?.trim() || "daemon-dev-key",
    tenantId: import.meta.env.VITE_DAEMON_TENANT?.trim() || "default",
    domainId: import.meta.env.VITE_DAEMON_DOMAIN?.trim() || "foundation",
  });
}
