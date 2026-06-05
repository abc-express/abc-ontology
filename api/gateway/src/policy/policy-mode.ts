/** Production policy: upstream engine required; no dev defaults. */
export function isProductionPolicyMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "production" || env.DAEMON_POLICY_MODE === "prod";
}

export function isPolicySkipUpstream(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.DAEMON_POLICY_SKIP_UPSTREAM === "1" || env.DAEMON_POLICY_SKIP_UPSTREAM === "true";
}

/** Actions that must receive an upstream policy decision in production. */
export function requiresUpstreamPolicyDecision(
  action: string,
  resource: string,
): boolean {
  if (action === "write" || action === "delete") {
    return true;
  }
  if (action === "read") {
    return (
      resource === "entity" ||
      resource === "lakehouse" ||
      resource.startsWith("lakehouse") ||
      resource === "ingest-job"
    );
  }
  if (action === "query") {
    return (
      resource === "ontology-nl" ||
      resource === "ontology-search" ||
      resource === "analytics"
    );
  }
  if (action === "ingest") {
    return resource.startsWith("ingest");
  }
  if (action === "chat") {
    return resource === "customer-gpt" || resource === "agent-worker";
  }
  return false;
}
