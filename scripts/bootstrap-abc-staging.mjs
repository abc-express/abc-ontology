#!/usr/bin/env node
/**
 * Ingest ABC Express fixture sources on a running staging gateway.
 * Requires DAEMON_ABC_FIXTURES=1 on the gateway and an admin-capable API key.
 *
 * Usage:
 *   DAEMON_GATEWAY_URL=https://... DAEMON_STAGING_API_KEY=... node scripts/bootstrap-abc-staging.mjs
 */
const base = (process.env.DAEMON_GATEWAY_URL ?? "http://127.0.0.1:3000").replace(
  /\/$/,
  "",
);
const apiKey =
  process.env.DAEMON_STAGING_API_KEY ??
  process.env.DAEMON_API_KEY ??
  process.env.DAEMON_STAGING_ANALYST_API_KEY;
const tenant = process.env.DAEMON_TENANT_ID ?? "abc-antero";
const domain = process.env.DAEMON_DOMAIN_ID ?? "logistics";

const FIXTURE_SOURCES = [
  "abc-fixture-shipments",
  "abc-fixture-manifests",
  "abc-fixture-dispatches",
  "abc-fixture-trips",
  "abc-fixture-ttk",
  "abc-fixture-orders",
  "abc-fixture-accounts",
  "abc-fixture-contacts",
  "abc-fixture-leads",
  "abc-fixture-opportunities",
  "abc-fixture-pipelines",
  "abc-fixture-signals",
  "abc-fixture-obl-manifests",
];

function headers() {
  if (!apiKey) {
    throw new Error(
      "Set DAEMON_STAGING_API_KEY (or DAEMON_API_KEY) with ingest-capable role",
    );
  }
  return {
    "content-type": "application/json",
    "x-api-key": apiKey,
    "x-daemon-tenant": tenant,
    "x-daemon-domain": domain,
  };
}

async function main() {
  const health = await fetch(`${base}/health`);
  if (!health.ok) {
    throw new Error(`gateway health failed: ${health.status}`);
  }
  console.log(`bootstrap-abc-staging: gateway OK at ${base}`);

  for (const sourceId of FIXTURE_SOURCES) {
    const res = await fetch(`${base}/v1/ingest/sources/${sourceId}/run`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({}),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`${sourceId}: ${res.status} ${text}`);
    }
    const body = JSON.parse(text);
    console.log(`${sourceId}: accepted=${body.accepted ?? "?"}`);
  }

  console.log("bootstrap-abc-staging: done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
