# Overview

## Purpose

daemon-sdk implements a semantic control plane: ingest external data, model it in an ontology, serve reads and governed writes to humans and agents, and execute workflows with security and audit across the stack.

## Confirmed scope

| Item | Choice |
|------|--------|
| Layout | Monorepo at repository root |
| npm | `@daemon/platform-types`, `@daemon/sdk`, `@daemon/cli` |
| API | NestJS (`api/gateway`) |
| Tests | testcontainers / docker-compose — no mocks in integration or e2e |

## Bounded contexts

1. **collect-sensing** — ingest, normalize, enrich only; no business decisions.
2. **ontology** — entities, relations, events, semantic index, vectors, projections; scoped by tenant and domain.
3. **read-write-loops** — all human/agent reads and writes, approvals, external writes.
4. **action-runtime** — workflows, agents, commands; does not own ontology definitions.
5. **security-governance** — cross-cutting auth, policy, audit, guardrails.
6. **context-ports** (`@daemon/context-ports`) — `OntologyStore` and `AuditPort` interfaces used by the gateway composition root.

The NestJS gateway exposes ingest, read, and write through `DaemonRuntime` rather than calling registry or command types directly. See [02-bounded-contexts.md](./02-bounded-contexts.md) and [08-semantic-governance-alignment.md](./08-semantic-governance-alignment.md) (Ontology Master / Technology OS → module mapping tables).

## Milestones

- **M1** Foundation: configs, language validators, engines, data-platform clients, platform-types.
- **M2** Ingest + ontology (Go/Rust/TS).
- **M3** Read/write loops + security.
- **M4** Action runtime + NestJS + SDK/CLI.
- **M5** Observability, deployment, toolchain, full test suite.
- **Durability** (gateway): versioned Postgres migrations, entity snapshot journal + replay on startup, extended audit columns (`tenant_id`, `domain_id`, `metadata`). See [06-testing.md](./06-testing.md) and [06-deployment-topology.md](./06-deployment-topology.md).
- **Commercial ontology SSOT** (gateway): foundation pack relations/junctions, executable propagation (`read-model-projection`, `audit-loop`), governance policy gates for breaking schema changes, Postgres change log + RLS + graph edge persistence for `Link`. See [08-semantic-governance-alignment.md](./08-semantic-governance-alignment.md).
- **Logistics-commercial extension** (implemented P0): extension pack and `logistics` domain; propagation and gateway tests. Public stub: [PRD-logistics-commercial-extension.md](./PRD-logistics-commercial-extension.md).
- **Semantic + vector search** (gateway): hybrid index via propagation target `semantic-vector-index`; `GET /v1/search` and analytics QueryWizard. See [02-ontology-system.md](./02-ontology-system.md).
- **Lakehouse** (Postgres): bronze append trail, silver latest entity state, gold SQL rollups; `GET /v1/lakehouse/events` and `GET /v1/lakehouse/summary`. See [11-data-platform-lakehouse.md](./11-data-platform-lakehouse.md).
- **Customer GPT** (gateway): `POST /v1/products/customer-gpt/chat` with hybrid retrieval and optional OpenRouter LLM.
- **Connectors catalog**: `configs/collect-sensing/connectors-catalog.yaml`; `pnpm run check:sources`. See [12-connectors-catalog.md](./12-connectors-catalog.md).
- **TypeScript SDK**: `@daemon/sdk` `DaemonClient`, pack codegen, OpenAPI parity checks. See [13-sdk.md](./13-sdk.md).
- **Data integration map** (Foundry-style datasets, pipelines, CDC, lakehouse analogues): [14-data-integration-map.md](./14-data-integration-map.md).
- **Data connection map** (cloud pull vs agent-style ingest, TLS, permissions): [15-data-connection-map.md](./15-data-connection-map.md).
- **Data Ops lifecycle** (Connect → Transform → Model → Analyze, roles, Pipeline Builder analogue): [16-data-ops-lifecycle-map.md](./16-data-ops-lifecycle-map.md).
- **Platform decision model** (Data / Logic / Actions ↔ daemon-sdk): [17-platform-decision-map.md](./17-platform-decision-map.md).
- **Enterprise platform map** (Foundry-style layers, `products/`, AIP): [18-enterprise-platform-map.md](./18-enterprise-platform-map.md).
- **Product parity program** (mimic stack, golden E2E, no domain mocks): weighted capability matrix in [19-product-parity-matrix.md](./19-product-parity-matrix.md); CI runs `pnpm run check:parity-matrix` and `tests/integration/foundry-parity-golden.integration.test.ts` with `DAEMON_INTEGRATION_REQUIRED=1`.
- **Production E2E (DSDK)** — Connect: S3/Kafka connectors, cron ingest schedules, webhook ingress, `toolchain/collect-agent` CLI. Data plane: lakehouse export (JSONL + catalog + Iceberg metadata sidecar), media object registry, `GET /v1/data-health/summary`. Semantic: logistics P1 entities (`Opportunity`, `Conversation`), pack branch resolution, `toolchain/mcp/ontology-mcp`. Products: `pipeline-builder`, `aip-evals`, `data-health` via product router. Console: [apps/dsdk-console](../apps/dsdk-console/) (Connect, Pipeline, Ontology, Lakehouse, AIP). Deploy: [deployment/docker/compose.prod.yaml](../deployment/docker/compose.prod.yaml), Helm/K8s, [05-observability-runbook.md](./05-observability-runbook.md). Smoke: `tests/integration/dsdk-production-smoke.integration.test.ts` (requires `DAEMON_POSTGRES_URL`).
- **Go-live guide** (single-environment production cutover): deployment profiles (Minimal / Standard / Full), ordered checklist, per-domain onboarding — [20-deployment-go-live-guide.md](./20-deployment-go-live-guide.md).

See [01-end-to-end-architecture.md](./01-end-to-end-architecture.md) for the system diagram.
