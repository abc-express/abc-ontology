import { Injectable } from "@nestjs/common";
import type { PolicyDecision } from "@daemon/platform-types";

function devDefaultDecision(action: string, resource: string): PolicyDecision {
  const allowed =
    ((action === "read" || action === "write") && resource === "entity") ||
    (action === "query" && resource === "analytics") ||
    (action === "ingest" && resource.startsWith("ingest"));
  return {
    effect: allowed ? "allow" : "deny",
    reason: allowed ? "dev-default" : "no rule",
  };
}

@Injectable()
export class PolicyService {
  async check(action: string, resource: string): Promise<PolicyDecision> {
    const url = process.env.POLICY_ENGINE_URL;
    const skipUpstream =
      process.env.DAEMON_POLICY_SKIP_UPSTREAM === "1" ||
      process.env.DAEMON_POLICY_SKIP_UPSTREAM === "true";
    if (url && !skipUpstream) {
      try {
        const res = await fetch(`${url}/check`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, resource }),
        });
        if (res.ok) return (await res.json()) as PolicyDecision;
      } catch {
        // Policy engine not reachable — fall back so local dev works without :8082
      }
    }
    return devDefaultDecision(action, resource);
  }
}
