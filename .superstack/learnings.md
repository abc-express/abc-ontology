# Project Learnings

> Managed by `/learn`. Append-only — latest entry wins on conflicts.

## Patterns

### tenant-domain-headers
- **Insight:** Scope HTTP requests with `X-Daemon-Tenant` and `X-Daemon-Domain` (defaults `default` / `foundation` from YAML catalogs).
- **Confidence:** 8/10
- **Source:** learn-repo-bootstrap
- **Files:** docs/02-bounded-contexts.md
- **Date:** 2026-06-04

### propagation-on-write
- **Insight:** Entity register/patch runs `PropagationExecutor` targets from `configs/governance/propagation.yaml` (search index, lakehouse bronze/silver, graph sync, read-model projections).
- **Confidence:** 8/10
- **Source:** learn-repo-bootstrap
- **Files:** ontology/governance/propagation-executor.ts, api/gateway/src/platform/daemon-runtime.ts, configs/governance/propagation.yaml
- **Date:** 2026-06-04

### search-replay-on-boot
- **Insight:** With `DAEMON_POSTGRES_URL`, `initDaemonRuntime` calls `replaySearchIndex` to rebuild in-memory hybrid search from the entity journal without re-ingesting.
- **Confidence:** 9/10
- **Source:** learn-repo-bootstrap
- **Files:** ontology/search/replay-search-index.ts, api/gateway/src/platform/daemon-runtime.ts
- **Date:** 2026-06-04

### ingest-before-automation
- **Insight:** Run ingest before automations or reads against an entity; otherwise the read path returns `404` with `{ "code": "NOT_FOUND" }`.
- **Confidence:** 9/10
- **Source:** learn-repo-bootstrap
- **Files:** README.md
- **Date:** 2026-06-04

### dev-skip-upstream-services
- **Insight:** Local gateway dev uses `DAEMON_INGEST_SKIP_UPSTREAM=1` and `DAEMON_POLICY_SKIP_UPSTREAM=1` when Go ingest/policy services are not running (`pnpm run dev:gateway` sets these).
- **Confidence:** 8/10
- **Source:** learn-repo-bootstrap
- **Files:** .env.example, package.json
- **Date:** 2026-06-04

## Pitfalls

### replay-skips-propagation
- **Insight:** `replaySearchIndex` only rebuilds the in-memory search index from the journal; it does not re-run propagation (avoids duplicate lakehouse bronze rows).
- **Confidence:** 9/10
- **Source:** learn-repo-bootstrap
- **Files:** ontology/search/replay-search-index.ts
- **Date:** 2026-06-04

### init-vs-get-runtime
- **Insight:** `getDaemonRuntime()` without `initDaemonRuntime()` skips Postgres migrations, durable store, registry replay, and search replay — use `initDaemonRuntime` in production and integration boots.
- **Confidence:** 8/10
- **Source:** learn-repo-bootstrap
- **Files:** api/gateway/src/platform/daemon-runtime.ts
- **Date:** 2026-06-04

### embedding-provider-restart
- **Insight:** Changing `DAEMON_EMBEDDING_PROVIDER` or `DAEMON_EMBEDDING_MODEL` requires a gateway restart so startup replay re-embeds all documents with the active embedder.
- **Confidence:** 8/10
- **Source:** learn-repo-bootstrap
- **Files:** docs/02-ontology-system.md
- **Date:** 2026-06-04

## Preferences

### no-jest-mock-integration
- **Insight:** Integration and e2e suites avoid `jest.mock` and in-memory fake databases unless `DAEMON_USE_EMBEDDED=1` for local-only dev; domain logic uses real implementations.
- **Confidence:** 8/10
- **Source:** learn-repo-bootstrap
- **Files:** README.md, docs/06-testing.md
- **Date:** 2026-06-04

### deterministic-embeddings-default
- **Insight:** Default `DAEMON_EMBEDDING_PROVIDER=deterministic` keeps CI and local hybrid search stable without OpenRouter API keys.
- **Confidence:** 8/10
- **Source:** learn-repo-bootstrap
- **Files:** docs/02-ontology-system.md
- **Date:** 2026-06-04

## Architecture

### gateway-composition-root
- **Insight:** NestJS HTTP flows compose through `DaemonRuntime`; gateway services must not import `globalRegistry` or `CommandGateway` directly.
- **Confidence:** 9/10
- **Source:** learn-repo-bootstrap
- **Files:** api/gateway/src/platform/daemon-runtime.ts, scripts/check-context-boundaries.mjs, docs/02-bounded-contexts.md
- **Date:** 2026-06-04

### bounded-context-boundaries
- **Insight:** collect-sensing ingests and normalizes; ontology holds semantic truth; read-write-loops run governed reads/writes; action-runtime runs workflows without owning the registry.
- **Confidence:** 9/10
- **Source:** learn-repo-bootstrap
- **Files:** docs/02-bounded-contexts.md
- **Date:** 2026-06-04

### postgres-durable-ssot
- **Insight:** When `DAEMON_POSTGRES_URL` is set, `initDaemonRuntime` runs migrations, wraps the store with `DurableOntologyStore`, replays snapshots into the registry, and optionally replays the search index (`DAEMON_SEARCH_REPLAY` defaults on).
- **Confidence:** 9/10
- **Source:** learn-repo-bootstrap
- **Files:** api/gateway/src/platform/daemon-runtime.ts, docs/06-testing.md
- **Date:** 2026-06-04

### data-ops-lifecycle-map
- **Insight:** Operational data work is documented as four phases—Connect (sources/connectors), Transform (ingest + propagation → bronze), Model (pack + journal + silver/gold), Analyze (search, lakehouse, products)—see docs/16; Foundry Pipeline Builder is only an analogue for Transform, not a built UI.
- **Confidence:** 8/10
- **Source:** data-ops-foundry-docs-plan
- **Files:** docs/16-data-ops-lifecycle-map.md, docs/14-data-integration-map.md, docs/15-data-connection-map.md
- **Date:** 2026-06-04

### platform-decision-model-map
- **Insight:** Foundry-style Data / Logic / Actions maps to daemon entities+ingest+lakehouse+search, policy+propagation+workflows+query/GPT, and read-write-loops+automations; `ontology-query` is gateway `POST /v1/query/ask`, not a `ProductId` in product-router.
- **Confidence:** 8/10
- **Source:** data-ops-foundry-docs-plan
- **Files:** docs/17-platform-decision-map.md, docs/18-enterprise-platform-map.md, products/product-shell/product-router.ts, api/gateway/src/query/
- **Date:** 2026-06-04

## Tools

### check-architecture-ci
- **Insight:** `pnpm run check:architecture` fails if gateway read/write/ingest services reference `globalRegistry` or `CommandGateway` instead of `DaemonRuntime`.
- **Confidence:** 9/10
- **Source:** learn-repo-bootstrap
- **Files:** scripts/check-context-boundaries.mjs, package.json
- **Date:** 2026-06-04

### integration-needs-postgres
- **Insight:** `pnpm run test:repo` Postgres integration tests skip when `DAEMON_POSTGRES_URL` is unset or nothing listens on that URL; use `daemon_app` role after `pnpm run db:migrate`.
- **Confidence:** 8/10
- **Source:** learn-repo-bootstrap
- **Files:** docs/06-testing.md, package.json
- **Date:** 2026-06-04

### production-e2e-gateway-surfaces
- **Insight:** DSDK production gap work adds gateway routes (schedules, webhooks, data-health, lakehouse export, media, pack-resolution, pipelines, evals) wired only through `DaemonRuntime`; SDK + OpenAPI parity and `dsdk-production-smoke` integration test require `DAEMON_POSTGRES_URL` for schedule/export tables.
- **Confidence:** 9/10
- **Source:** dsdk-gap-production-e2e
- **Files:** packages/sdk/src/client.ts, api/rest/src/openapi.ts, tests/integration/dsdk-production-smoke.integration.test.ts, apps/dsdk-console/
- **Date:** 2026-06-04

### lakehouse-export-mvp-jsonl
- **Insight:** Lakehouse “export” MVP writes scoped bronze rows as JSONL on disk plus `daemon_dataset_catalog` and an Iceberg metadata sidecar—not full `@apache/iceberg` or native Parquet writers yet.
- **Confidence:** 8/10
- **Source:** dsdk-gap-production-e2e
- **Files:** data-platform/lakehouse/export/lakehouse-exporter.ts, docs/11-data-platform-lakehouse.md
- **Date:** 2026-06-04

### ontology-mcp-sidecar
- **Insight:** Consumer-agent ontology access can use `toolchain/mcp/ontology-mcp` (stdio MCP) proxying gateway search/read/lakehouse/query—not a Palantir OMCP product.
- **Confidence:** 8/10
- **Source:** dsdk-gap-production-e2e
- **Files:** toolchain/mcp/ontology-mcp/server.mjs, docs/17-platform-decision-map.md
- **Date:** 2026-06-04
