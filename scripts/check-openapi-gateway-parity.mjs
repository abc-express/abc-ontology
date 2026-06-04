#!/usr/bin/env node
/**
 * Compare gateway route inventory to OpenAPI paths (critical v1 surface).
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

/** Nest controller routes the public SDK documents. */
const EXPECTED_GATEWAY_ROUTES = [
  { method: "GET", path: "/health" },
  { method: "POST", path: "/v1/write" },
  { method: "GET", path: "/v1/read/entities/{entityId}" },
  { method: "GET", path: "/v1/search" },
  { method: "GET", path: "/v1/lakehouse/events" },
  { method: "GET", path: "/v1/lakehouse/summary" },
  { method: "GET", path: "/v1/analytics/lakehouse-summary" },
  { method: "GET", path: "/v1/read/entities" },
  { method: "GET", path: "/v1/ingest/jobs" },
  { method: "POST", path: "/v1/ingest/jobs" },
  { method: "GET", path: "/v1/ingest/jobs/{id}" },
  { method: "POST", path: "/v1/ingest/sources/{sourceId}/run" },
  { method: "POST", path: "/v1/ingest/records" },
  { method: "POST", path: "/v1/ingest/webhooks/{sourceId}" },
  { method: "POST", path: "/v1/ingest/listeners/{listenerId}/events" },
  { method: "POST", path: "/v1/agents/sessions" },
  { method: "POST", path: "/v1/agents/sessions/{sessionId}/tools" },
  { method: "POST", path: "/v1/functions/{functionId}/invoke" },
  { method: "POST", path: "/v1/evals/record" },
  { method: "POST", path: "/v1/governance/pack/promote" },
  { method: "GET", path: "/v1/ops/health" },
  { method: "POST", path: "/v1/query/ask" },
  { method: "POST", path: "/v1/products/customer-gpt/chat" },
  { method: "POST", path: "/v1/policy/check" },
  { method: "POST", path: "/v1/automations/run" },
  { method: "POST", path: "/v1/automations/evaluate" },
  { method: "POST", path: "/v1/automations/approve" },
  { method: "GET", path: "/v1/ingest/schedules" },
  { method: "POST", path: "/v1/ingest/schedules" },
  { method: "PATCH", path: "/v1/ingest/schedules/{id}" },
  { method: "GET", path: "/v1/data-health/summary" },
  { method: "POST", path: "/v1/lakehouse/export" },
  { method: "GET", path: "/v1/lakehouse/exports/{exportId}" },
  { method: "GET", path: "/v1/media/objects" },
  { method: "POST", path: "/v1/media/objects" },
  { method: "GET", path: "/v1/ontology/pack-resolution" },
  { method: "POST", path: "/v1/pipelines/{pipelineId}/run" },
  { method: "POST", path: "/v1/evals/run" },
  { method: "GET", path: "/v1/evals/runs" },
];

function loadOpenApiPaths() {
  const openapiPath = join(root, "api/rest/src/openapi.ts");
  const src = readFileSync(openapiPath, "utf8");
  const paths = new Set();
  for (const m of src.matchAll(/"(\/[^"]+)":\s*\{/g)) {
    paths.add(m[1]);
  }
  return paths;
}

function methodOnPath(openapiSrc, path, method) {
  const re = new RegExp(
    `"${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}":\\s*\\{[\\s\\S]*?${method}:\\s*\\{`,
  );
  return re.test(openapiSrc);
}

function main() {
  const openapiPath = join(root, "api/rest/src/openapi.ts");
  const src = readFileSync(openapiPath, "utf8");
  const paths = loadOpenApiPaths();
  const missing = [];

  for (const { method, path } of EXPECTED_GATEWAY_ROUTES) {
    if (!paths.has(path)) {
      missing.push(`${method} ${path} (path missing in OpenAPI)`);
      continue;
    }
    const m = method.toLowerCase();
    if (!methodOnPath(src, path, m)) {
      missing.push(`${method} ${path} (${m} operation missing)`);
    }
  }

  if (missing.length) {
    console.error("check-openapi-gateway-parity FAILED:");
    for (const line of missing) console.error(`  ${line}`);
    process.exit(1);
  }
  console.log(
    `check-openapi-gateway-parity OK — ${EXPECTED_GATEWAY_ROUTES.length} gateway routes documented`,
  );
}

main();
