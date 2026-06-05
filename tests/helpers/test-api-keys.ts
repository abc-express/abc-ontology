import { randomUUID } from "node:crypto";

/** Primary API key for gateway integration harnesses (from env). */
export function primaryTestApiKey(env: NodeJS.ProcessEnv = process.env): string {
  const configured =
    env.DAEMON_API_KEY?.trim() ?? env.DAEMON_TEST_DEFAULT_API_KEY?.trim();
  if (configured) return configured;
  throw new Error(
    "Set DAEMON_API_KEY or DAEMON_TEST_DEFAULT_API_KEY for integration tests",
  );
}

/** Ephemeral tenant-scoped key for multi-tenant isolation tests. */
export function syntheticTestApiKey(label: string): string {
  const slug = label.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  return `test-${slug}-${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}
