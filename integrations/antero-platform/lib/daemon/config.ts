export type DaemonClientRole = "viewer" | "analyst";

export function daemonOntologyId(): string {
  return process.env.DAEMON_ONTOLOGY_ID ?? "foundation";
}

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing server env: ${name}`);
  }
  return value;
}

export function daemonGatewayUrl(): string {
  return requireEnv("DAEMON_GATEWAY_URL").replace(/\/$/, "");
}

export function daemonTenantId(): string {
  return process.env.DAEMON_TENANT_ID ?? "abc-antero";
}

export function daemonDomainId(): string {
  return process.env.DAEMON_DOMAIN_ID ?? "logistics";
}
