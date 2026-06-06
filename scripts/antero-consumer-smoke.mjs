#!/usr/bin/env node
/**
 * Fase A consumer smoke: read/search/shadow-pricing/query/gpt against staging gateway.
 *
 * Env:
 *   DAEMON_GATEWAY_URL (required when DAEMON_STAGING_SMOKE_REQUIRE_GATEWAY=1)
 *   DAEMON_STAGING_VIEWER_API_KEY — logistics-viewer (read/query, no chat)
 *   DAEMON_STAGING_ANALYST_API_KEY — commercial-analyst (chat + agents)
 *   DAEMON_SKIP_QUERY=1 | DAEMON_SKIP_GPT=1 — skip optional Neo4j/LLM checks
 */
const base = (process.env.DAEMON_GATEWAY_URL ?? "http://127.0.0.1:3000").replace(
  /\/$/,
  "",
);
const requireGateway = process.env.DAEMON_STAGING_SMOKE_REQUIRE_GATEWAY === "1";
const tenant = process.env.DAEMON_TENANT_ID ?? "abc-antero";
const domain = process.env.DAEMON_DOMAIN_ID ?? "logistics";
const ontology = process.env.DAEMON_ONTOLOGY_ID ?? "foundation";
const sampleShipmentRef =
  process.env.DAEMON_SAMPLE_SHIPMENT_REF ?? "SHP-ABC-001";

const viewerKey = process.env.DAEMON_STAGING_VIEWER_API_KEY;
const analystKey = process.env.DAEMON_STAGING_ANALYST_API_KEY;

function authHeaders(apiKey, extra = {}) {
  return {
    "content-type": "application/json",
    "x-api-key": apiKey,
    "x-daemon-tenant": tenant,
    "x-daemon-domain": domain,
    ...extra,
  };
}

async function check(name, fn) {
  try {
    await fn();
    console.log(`  OK ${name}`);
    return true;
  } catch (err) {
    console.error(`  FAIL ${name}: ${err?.message ?? err}`);
    return false;
  }
}

async function main() {
  if (!viewerKey && !analystKey) {
    const msg =
      "Set DAEMON_STAGING_VIEWER_API_KEY and/or DAEMON_STAGING_ANALYST_API_KEY";
    if (requireGateway) throw new Error(msg);
    console.warn(`antero-consumer-smoke: skipped (${msg})`);
    return;
  }

  const results = [];

  results.push(
    await check("health", async () => {
      const res = await fetch(`${base}/health`);
      if (!res.ok) throw new Error(String(res.status));
    }),
  );

  const readKey = viewerKey ?? analystKey;
  results.push(
    await check("list Shipment", async () => {
      const res = await fetch(
        `${base}/v1/read/entities?ontologyId=${ontology}&entityType=Shipment&limit=50`,
        { headers: authHeaders(readKey) },
      );
      const text = await res.text();
      if (!res.ok) throw new Error(text);
      const body = JSON.parse(text);
      if (!Array.isArray(body.items) || body.items.length < 1) {
        throw new Error("no shipments — run bootstrap-abc-staging.mjs first");
      }
    }),
  );

  results.push(
    await check("search Shipment", async () => {
      const res = await fetch(
        `${base}/v1/search?q=${encodeURIComponent("Shipment")}&ontologyId=${ontology}&limit=10`,
        { headers: authHeaders(readKey) },
      );
      const text = await res.text();
      if (!res.ok) throw new Error(text);
    }),
  );

  results.push(
    await check("shadow-pricing simulate", async () => {
      const res = await fetch(`${base}/v1/products/shadow-pricing/simulate`, {
        method: "POST",
        headers: authHeaders(readKey),
        body: JSON.stringify({
          ontologyId,
          shipmentRef: sampleShipmentRef,
        }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text);
      const body = JSON.parse(text);
      if (body.readOnly !== true) throw new Error("expected readOnly: true");
      if ((body.shipments?.count ?? 0) < 1) {
        throw new Error("shipments.count < 1");
      }
    }),
  );

  if (!process.env.DAEMON_SKIP_QUERY && readKey) {
    results.push(
      await check("queryAsk (optional graph)", async () => {
        const res = await fetch(`${base}/v1/query/ask`, {
          method: "POST",
          headers: authHeaders(readKey),
          body: JSON.stringify({
            question: "How many Shipment entities exist?",
            ontologyId,
          }),
        });
        if (res.status === 503 || res.status === 501) {
          console.log("    (graph/LLM unavailable — acceptable in staging)");
          return;
        }
        const text = await res.text();
        if (!res.ok) throw new Error(text);
      }),
    );
  }

  if (viewerKey) {
    results.push(
      await check("GPT with viewer key → 403", async () => {
        const res = await fetch(`${base}/v1/products/customer-gpt/chat`, {
          method: "POST",
          headers: authHeaders(viewerKey),
          body: JSON.stringify({
            turns: [{ role: "user", content: "hello" }],
            ontologyId,
          }),
        });
        if (res.status !== 403) {
          throw new Error(`expected 403, got ${res.status}`);
        }
      }),
    );
  }

  if (!process.env.DAEMON_SKIP_GPT && analystKey) {
    results.push(
      await check("GPT with analyst key", async () => {
        const res = await fetch(`${base}/v1/products/customer-gpt/chat`, {
          method: "POST",
          headers: authHeaders(analystKey),
          body: JSON.stringify({
            turns: [{ role: "user", content: "List shipment statuses briefly." }],
            ontologyId,
          }),
        });
        const text = await res.text();
        if (res.status === 503) {
          console.log("    (LLM unavailable — acceptable without OPENROUTER_API_KEY)");
          return;
        }
        if (!res.ok) throw new Error(text);
      }),
    );
  }

  const failed = results.filter((ok) => !ok).length;
  if (failed > 0) {
    console.error(`antero-consumer-smoke FAILED (${failed} checks)`);
    process.exit(1);
  }
  console.log("antero-consumer-smoke OK");
}

main().catch((err) => {
  if (requireGateway) {
    console.error(`antero-consumer-smoke FAILED: ${err?.message ?? err}`);
    process.exit(1);
  }
  console.warn(`antero-consumer-smoke: ${err?.message ?? err}`);
});
