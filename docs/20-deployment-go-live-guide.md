# Deployment go-live guide

Operational checklist for taking a **single customer environment** from “parity green in CI” to a running production stack. This guide assumes you already understand topology ([06-deployment-topology.md](./06-deployment-topology.md)) and what the mimic stack covers ([19-product-parity-matrix.md](./19-product-parity-matrix.md)).

## Prerequisites

Before you deploy application services, confirm the following.

| Requirement | Notes |
|-------------|--------|
| **Postgres** | `DAEMON_POSTGRES_URL` pointing at Postgres 16+ with TLS in prod (`configs/environments/prod.yaml` uses `ssl: true`). |
| **Migrations** | Run `pnpm run db:migrate` on a fresh or upgraded database before starting the gateway. |
| **Tenant and domain** | Ontology packs and `domain_id` scoped in gateway config; foundation pack under `configs/ontology/packs/foundation/`. |
| **API keys / auth** | Production sets `security.enforceAuth: true` in `prod.yaml`. Gateway uses API-key style auth in the current stack—not a full enterprise IdP integration in the gateway itself. |
| **Optional upstream** | Ingest connectors need credentials (S3, Kafka, HTTP pull, Postgres read). Webhooks need `DAEMON_WEBHOOK_HMAC_SECRET`. |
| **Optional LLM** | Customer GPT and some agent paths need OpenRouter or equivalent keys when enabled. |
| **Optional Neo4j** | Graph profile only: `DAEMON_ONTOLOGY_QUERY_ENABLED=1` and bolt URI (see [05-observability-runbook.md](./05-observability-runbook.md)). |

**Production requirement:** The gateway rejects memory-only SSOT in production. Set `DAEMON_POSTGRES_URL` before go-live. Do not rely on `DAEMON_SSOT_MODE=memory` outside explicit dev overrides.

## Deployment profiles

Pick a profile that matches customer scope. All profiles assume Postgres-backed gateway durability.

### Minimal

**Goal:** Ontology read/write and governance on a small footprint—no external connectors.

| Component | Included |
|-----------|----------|
| Postgres | Yes |
| Gateway (`api/gateway`) | Yes |
| Redis / NATS | Optional (compose prod includes them for future ingest) |
| Go ingest / Rust shim | Not required for static ontology-only pilots |
| External connectors | No |
| OTel / metrics | Optional |
| Neo4j | No |
| Helm / K8s | Optional (host-run gateway is fine for pilots) |

**Typical env:** `DAEMON_POSTGRES_URL`, `DAEMON_AUTH_MODE` per your auth setup, foundation pack loaded.

### Standard

**Goal:** Scheduled ingest, lakehouse bronze path, ops visibility—matches most forward-deploy engagements.

| Component | Included |
|-----------|----------|
| Everything in Minimal | Yes |
| Go ingest (`collect-sensing`) | Yes |
| Ingest schedules | `ingest.schedulePollSeconds` (60s in prod.yaml) |
| Lakehouse export path | `DAEMON_LAKEHOUSE_EXPORT_PATH` (default `/var/daemon/exports`) |
| OTel collector | `deployment/docker/compose.prod.yaml` → `otel-collector`; gateway `OTEL_EXPORTER_OTLP_ENDPOINT` |
| Metrics | `DAEMON_METRICS_ENABLED=1`, `GET /metrics` |
| Staging smoke | `pnpm run staging:smoke` (Helm chart + optional gateway probe) |

**Validation:** `DAEMON_STAGING_SMOKE_REQUIRE_GATEWAY=1` when the gateway must be reachable during smoke.

### Full

**Goal:** Connector catalog, graph profile, agent worker, Kubernetes—parity matrix “Apollo” and “Foundry-DC” rows.

| Component | Included |
|-----------|----------|
| Everything in Standard | Yes |
| S3 / Kafka / HTTP / Postgres connectors | Per `configs/collect-sensing/connectors-catalog.yaml`; `pnpm run check:sources` |
| Neo4j | `docker compose --profile graph` on compose prod |
| Agent worker | `deployment/helm/daemon-platform/templates/deployment-agent-worker.yaml` |
| Helm / K8s | `deployment/helm/daemon-platform/` |
| SIEM forwarding | Structured logs + audit path in [05-security-governance.md](./05-security-governance.md) |
| Parity golden (pre-promotion) | `DAEMON_INTEGRATION_REQUIRED=1` + `tests/integration/foundry-parity-golden.integration.test.ts` |
| DSDK production smoke | `tests/integration/dsdk-production-smoke.integration.test.ts` with `DAEMON_POSTGRES_URL` |

## Go-live sequence

Run steps in order. Adjust host vs Kubernetes only at the “deploy services” step.

### 1. Infrastructure

```bash
# From repo root — production-oriented data plane (Postgres, Redis, NATS, OTel; Neo4j optional)
export POSTGRES_PASSWORD='<strong-secret>'
docker compose -f deployment/docker/compose.prod.yaml up -d

# Optional graph profile
docker compose -f deployment/docker/compose.prod.yaml --profile graph up -d
```

Service URLs for app processes (when not in the same compose network): set `DATABASE_URL` / `DAEMON_POSTGRES_URL`, `REDIS_URL`, `NATS_URL` per [configs/environments/prod.yaml](../configs/environments/prod.yaml).

### 2. Database

```bash
export DAEMON_POSTGRES_URL='postgresql://daemon:<password>@<host>:5432/daemon?sslmode=require'
pnpm run db:migrate
```

### 3. Deploy gateway and ingest

**Docker / host:** Build and run gateway on port 3000; run Go ingest on 8081; Rust semantic shim on 8082 if hybrid search is enabled. See [06-deployment-topology.md](./06-deployment-topology.md) for the port matrix.

**Kubernetes:** Install chart from `deployment/helm/daemon-platform/` with values for image tags, secrets, and `DAEMON_GATEWAY_URL` / `DAEMON_INGEST_URL` injected into workloads.

### 4. Ontology packs

1. Validate foundation pack: tooling under `configs/ontology/packs/foundation/`.
2. Promote customer extension packs (e.g. `configs/ontology/packs/extensions/`) through governance APIs (`validate-change`, `promote`)—see [08-semantic-governance-alignment.md](./08-semantic-governance-alignment.md).
3. Run domain UAT against `GET /v1/read` and write paths before enabling production traffic.

### 5. Connectors and schedules

1. Register sources in ingest configuration aligned with [12-connectors-catalog.md](./12-connectors-catalog.md).
2. Configure cron schedules via gateway ingest schedule service.
3. Run `pnpm run check:sources` in CI or locally before cutover.
4. Verify `GET /v1/ops/health` and data-health endpoints when DSDK paths are enabled.

### 6. Smoke and parity gates

```bash
# Helm chart render + optional live gateway
export DAEMON_GATEWAY_URL='https://<gateway-host>'
pnpm run staging:smoke

# Require gateway during smoke
DAEMON_STAGING_SMOKE_REQUIRE_GATEWAY=1 pnpm run staging:smoke

# Parity matrix doc ↔ repo paths (CI)
pnpm run check:parity-matrix

# Golden integration (Postgres + repo root; no domain mocks)
export DAEMON_POSTGRES_URL='...'
export DAEMON_INTEGRATION_REQUIRED=1
pnpm exec vitest run tests/integration/foundry-parity-golden.integration.test.ts

# DSDK production paths (when customer uses console + connectors)
pnpm exec vitest run tests/integration/dsdk-production-smoke.integration.test.ts
```

### 7. Observability

Configure `OTEL_EXPORTER_OTLP_ENDPOINT`, import dashboards, and alert rules per [05-observability-runbook.md](./05-observability-runbook.md).

## Per-domain checklist

Use this when onboarding a **business domain** (e.g. logistics) on top of the foundation pack.

| Step | Action |
|------|--------|
| Pack | Extension pack validated and promoted; `domain_id` consistent in writes and RLS. |
| Entities | Required object types exist in pack; sample entities registered in UAT. |
| Connectors | Source credentials scoped to tenant; test run succeeds in ingest logs. |
| Lakehouse | Bronze events appear for domain; export path writable if customer needs files. |
| Search | Hybrid search index populated if `semantic-vector-index` propagation is on. |
| Actions | Workflows/agents tested with `DAEMON_AUTH_MODE` matching prod. |
| Parity | Rows in [19-product-parity-matrix.md](./19-product-parity-matrix.md) marked Live still match what you wired (matrix ≠ turnkey for every connector). |

Maps for integration and connection patterns: [14-data-integration-map.md](./14-data-integration-map.md), [15-data-connection-map.md](./15-data-connection-map.md), [16-data-ops-lifecycle-map.md](./16-data-ops-lifecycle-map.md).

## Post-go-live operations

| Topic | Reference |
|-------|-----------|
| Metrics and alerts | [05-observability-runbook.md](./05-observability-runbook.md) |
| Security and audit | [05-security-governance.md](./05-security-governance.md) |
| Incident loop | Governance + ops controllers; webhook signing rotation |
| Health | `GET /health`, `GET /v1/ops/health` |
| Read projection parity (staging) | `DAEMON_READ_FROM_PROJECTION`, `DAEMON_READ_PARITY_CHECK` per [06-deployment-topology.md](./06-deployment-topology.md) |

## Honest limits

- **Parity ≠ turnkey SaaS:** [19-product-parity-matrix.md](./19-product-parity-matrix.md) tracks mimic-stack capabilities with repo evidence. Customers still need ontology modeling, connector credentials, and UAT per vertical.
- **Auth:** Production enforces auth, but the gateway path documented here is API-key oriented—not a substitute for customer IdP/SSO program work.
- **Marketplace / private link / full Workshop:** Listed as planned in the parity doc and [15-data-connection-map.md](./15-data-connection-map.md)—not implied by go-live alone.
- **Multi-tenant SaaS:** This guide targets **one environment / tenant rollout**. Operating many tenants on shared infra requires additional isolation review (RLS, secrets, per-tenant packs) beyond this checklist.

## Related documentation

| Doc | Purpose |
|-----|---------|
| [06-deployment-topology.md](./06-deployment-topology.md) | Service diagram, compose files, K8s |
| [19-product-parity-matrix.md](./19-product-parity-matrix.md) | What is Live vs planned |
| [13-sdk.md](./13-sdk.md) | `@daemon/sdk` client configuration |
| [17-platform-decision-map.md](./17-platform-decision-map.md) | Where to place new features |

Published site mirror: Mintlify `/operations/go-live` (ported from this file).
