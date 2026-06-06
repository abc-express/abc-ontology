import { DaemonClient } from "@daemon/sdk";
import {
  daemonDomainId,
  daemonGatewayUrl,
  daemonTenantId,
  type DaemonClientRole,
} from "./config";

export function createAnteroDaemonClient(
  role: DaemonClientRole = "analyst",
): DaemonClient {
  const analystKey = process.env.DAEMON_API_KEY?.trim();
  const viewerKey =
    process.env.DAEMON_VIEWER_API_KEY?.trim() ?? analystKey;

  const apiKey = role === "viewer" ? viewerKey : analystKey;
  if (!apiKey) {
    throw new Error(
      role === "viewer"
        ? "Missing DAEMON_VIEWER_API_KEY or DAEMON_API_KEY"
        : "Missing DAEMON_API_KEY (commercial-analyst)",
    );
  }

  return new DaemonClient({
    baseUrl: daemonGatewayUrl(),
    apiKey,
    tenantId: daemonTenantId(),
    domainId: daemonDomainId(),
  });
}
