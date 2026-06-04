---
name: SDK parity roadmap
overview: First validate Experience layer v2 (Postgres migrations 005/006 and new integration tests), then close the developer-experience gap vs Palantir osdk-ts through contract expansion, a richer @daemon/sdk, and pack-driven codegen—without pretending to be a Foundry client.
todos:
  - id: validate-v2-postgres
    content: Run db:migrate (005/006), add search-replay + lakehouse-silver-gold integration tests to test:repo, verify green with DAEMON_POSTGRES_URL
    status: completed
  - id: openapi-gateway-parity
    content: Inventory gateway routes; extend api/rest openapi.ts with v1/read, search, lakehouse, products, ingest; add drift check test
    status: completed
  - id: sdk-client-expand
    content: Add DaemonClient methods (search, lakehouse, ingest, query, products, automations) + shared types + client tests
    status: completed
  - id: pack-codegen
    content: "Implement generate-pack-sdk script/CLI: YAML pack → generated entity/action types; CI stale check"
    status: completed
  - id: list-entities-api
    content: Add GET /v1/read/entities pagination + listEntities on SDK + policy wiring (Phase 4)
    status: completed
isProject: false
---

# Experience v2 validation + OSDK-style SDK parity

## Context

[Experience layer v2](.cursor/plans/experience_layer_v2_e38355c4.plan.md) is **implemented** (search replay, embedder factory, GPT sessions in Postgres, lakehouse silver/gold). The thin HTTP client in [`packages/sdk/src/client.ts`](packages/sdk/src/client.ts) still exposes only `health`, `readEntity`, `submitWrite`, and `checkPolicy`, while the Nest gateway exposes ingest, search, query, lakehouse, products/GPT, automations, governance, and analytics ([`api/gateway/src/*/*.controller.ts`](api/gateway/src)).

Palantir [osdk-ts](https://github.com/palantir/osdk-ts) is a **Foundry-hosted** stack (`@osdk/client`, `@osdk/oauth`, `@osdk/react`, ontology codegen). daemon-sdk is a **self-hosted** semantic control plane with YAML ontology packs ([`configs/ontology/packs/foundation/`](configs/ontology/packs/foundation/)) and governance ([`configs/governance/action-catalog.yaml`](configs/governance/action-catalog.yaml)). Parity means **developer ergonomics**, not API compatibility with Foundry.

```mermaid
flowchart LR
  subgraph today [Today]
    PackYAML[pack YAML]
    GW[Nest gateway]
    SDK["@daemon/sdk thin"]
    OAPI["api/rest openapi partial"]
    PackYAML --> GW
    SDK --> GW
    OAPI -.-> GW
  end
  subgraph target [Target]
    Gen[pack codegen]
    SDK2["@daemon/sdk full surface"]
    OAPI2[OpenAPI SSOT]
    Gen --> SDK2
    OAPI2 --> SDK2
    SDK2 --> GW
  end
```

---

## Phase 0 — Validation gate (Experience v2)

**Goal:** Prove durability features work against real Postgres before expanding the public SDK.

| Step | Action |
|------|--------|
| Dev stack | `pnpm --filter @daemon/cli exec daemon-cli dev up` (or existing compose) |
| Migrations | `pnpm run db:migrate` — applies [`005_gpt_sessions.sql`](data-platform/migrations/005_gpt_sessions.sql) and [`006_lakehouse_silver_gold.sql`](data-platform/migrations/006_lakehouse_silver_gold.sql) |
| Integration | Run with app role URL (see CLI hint): `DAEMON_POSTGRES_URL=postgresql://daemon_app:daemon_app@127.0.0.1:5432/daemon pnpm run test:repo` |
| New tests | Explicitly include [`tests/integration/search-replay.integration.test.ts`](tests/integration/search-replay.integration.test.ts) and [`tests/integration/lakehouse-silver-gold.integration.test.ts`](tests/integration/lakehouse-silver-gold.integration.test.ts) in [`package.json`](package.json) `test:repo` script (they exist per docs but are **not** in the current `test:repo` list) |
| Smoke | Optional: `DAEMON_EMBEDDING_PROVIDER=openrouter` + keys for one hybrid search hit; `DAEMON_SEARCH_REPLAY=0` to confirm opt-out |

**Exit criteria:** `pnpm run build`, `pnpm run spec:check`, and Postgres-gated integration tests green; gateway restart preserves GPT citations and search hits after replay.

---

## Phase 1 — Contract SSOT (OpenAPI ↔ gateway)

**Problem:** [`api/rest/src/openapi.ts`](api/rest/src/openapi.ts) documents a **subset** of gateway routes (legacy `/v1/entities/{id}` vs gateway `/v1/read/entities/:entityId`). Contract tests in [`tests/contract/api-contract.test.ts`](tests/contract/api-contract.test.ts) are **in-process** read/write loops, not HTTP OpenAPI drift checks.

**Approach (minimal, high leverage):**

1. **Inventory** gateway routes from controllers (read, write, search, ingest, query, lakehouse, products, automations, governance, policy, analytics).
2. **Extend** `openapi.ts` (or add `api/gateway/openapi.ts` re-exported by REST server) with:
   - Correct paths: `/v1/read/entities/{entityId}`, `/v1/search`, `/v1/lakehouse/summary`, `/v1/products/...`, ingest family, tenancy header params (reuse existing `DaemonTenantHeader` / `DaemonDomainHeader` pattern from [`.cursor/plans/dod_docs_openapi_f67212f3.plan.md`](.cursor/plans/dod_docs_openapi_f67212f3.plan.md)).
   - Shared schemas: `EntityRecord`, search result, write receipt, lakehouse summary, GPT session/citation shapes (align with gateway DTOs).
3. **Test:** Extend [`api/rest/src/server.test.ts`](api/rest/src/server.test.ts) to assert critical paths exist on `GET /openapi.json`; add optional script `scripts/check-openapi-gateway-parity.mjs` that compares controller route list to OpenAPI paths (fail on drift).

**Out of scope for Phase 1:** Auto-generating OpenAPI from Nest decorators (can follow later with `@nestjs/swagger` if desired).

---

## Phase 2 — Expand `@daemon/sdk` to match gateway

**Extend** [`DaemonClient`](packages/sdk/src/client.ts) with typed methods mirroring Phase 1 OpenAPI (hand-written types first; codegen in Phase 3):

| Method area | Gateway route | Notes |
|-------------|---------------|--------|
| Search | `GET /v1/search` | `q`, `ontologyId`, `limit`, `mode` (async server; client stays promise-based) |
| Lakehouse | `GET /v1/lakehouse/summary` | New in v2 |
| Ingest | `POST /v1/ingest/...` | Start with job/record endpoints used by e2e tests |
| Query | `POST /v1/query/...` | NL / Cypher entrypoints per [`query.controller.ts`](api/gateway/src/query/query.controller.ts) |
| Products GPT | `/v1/products/...` | Session + citations via [`GptSessionStore`](data-platform/product-sessions/gpt-session-store.ts) |
| Automations | `/v1/automations/...` | Run workflows |
| Read | Keep `readEntity`; align URL with gateway |

**Cross-cutting:**

- Export shared request/response types from `@daemon/platform-types` or new `@daemon/api-types` package to avoid duplication with OpenAPI schemas.
- Unit tests in [`packages/sdk/src/client.test.ts`](packages/sdk/src/client.test.ts) with `fetch` mock.
- Document in [`docs/`](docs/) (e.g. extend bounded-contexts or add `docs/12-sdk.md`).

---

## Phase 3 — Pack-driven codegen (osdk generator analogue)

**Inputs:** [`configs/ontology/packs/{packId}/`](configs/ontology/packs/foundation/) (`pack.yaml`, `entities/*.yaml`, relations, junctions) + [`action-catalog.yaml`](configs/governance/action-catalog.yaml).

**Outputs (per pack, default `foundation`):**

- `generated/{packId}/entities.ts` — entity type literals + field interfaces from YAML `fields`.
- `generated/{packId}/actions.ts` — allowed `action` + `resource` pairs for policy-aware clients.
- Optional `generated/{packId}/client.ts` — thin wrappers: `client.foundation.Party.read(id)` calling generic SDK methods with fixed `ontologyId`.

**Tooling:**

- New package [`packages/codegen`](packages/codegen) or script [`scripts/generate-pack-sdk.mjs`](scripts/generate-pack-sdk.mjs) (consistent with [`scripts/validate-ontology-pack.mjs`](scripts/validate-ontology-pack.mjs)).
- CLI: `daemon-cli ontology generate-sdk --pack foundation --out packages/sdk/generated` (extend [`packages/cli/src/cli.ts`](packages/cli/src/cli.ts)).
- CI: run codegen in `spec:check` or dedicated `pnpm run codegen:check` (fail if generated output stale).

**Design choices:**

- **Deterministic output** (sorted keys, stable formatting) for reviewable diffs.
- **No Foundry OAuth** — session header model stays ([`Protected`](api/gateway/src/auth/protected.decorator.ts) + `x-daemon-session`).
- Codegen reads **pack SSOT only**; logistics extension pack follows same pipeline when added under `configs/ontology/packs/`.

---

## Phase 4 — Object-set / list API (largest functional gap vs OSDK)

OSDK centers on **filtered object sets**; gateway today only supports **get-by-id** ([`read.controller.ts`](api/gateway/src/read/read.controller.ts)).

**Minimal viable addition:**

- `GET /v1/read/entities?ontologyId=&entityType=&limit=&cursor=` — page over Postgres journal or registry snapshot (reuse [`PostgresEntityJournal`](data-platform/operational-store/entity-journal.ts) / durable store queries; respect RLS tenant).
- Optional filters: `updatedAfter`, simple field equality (defer full query language to [`products/ontology-query`](products/ontology-query)).
- SDK: `listEntities(params)` + codegen helpers per entity type.

**Governance:** `read` + `entity` already in action catalog; wire `@PolicyCheck` on new route.

---

## Phase 5 — Optional later (not in first implementation slice)

- **`@daemon/react`**: hooks for search, entity detail, write mutations (pattern only; no Palantir UI clone).
- **OpenAPI → TypeScript** via `openapi-typescript` once Phase 1 stabilizes.
- **Gateway serves `/openapi.json`** directly (single contract source for SDK and external integrators).

---

## Non-goals

- Replacing Foundry / connecting to Palantir cloud APIs.
- Dropping YAML packs for Foundry ontology export format.
- Full OSDK React component library or OAuth device flow parity.
- Public docs naming confidential counterparties (per NDA guardrails); keep partner material in [`docs/private/`](docs/private/).

---

## Suggested implementation order

1. Phase 0 (validation + wire integration tests into `test:repo`).
2. Phase 1 (OpenAPI inventory + extension).
3. Phase 2 (`@daemon/sdk` methods + types).
4. Phase 3 (codegen CLI + foundation pack output).
5. Phase 4 (list entities API) when product needs browse/search UX beyond vector search.

---

## Key files reference

| Area | Path |
|------|------|
| Thin SDK | [`packages/sdk/src/client.ts`](packages/sdk/src/client.ts) |
| OpenAPI | [`api/rest/src/openapi.ts`](api/rest/src/openapi.ts) |
| Pack SSOT | [`configs/ontology/packs/foundation/`](configs/ontology/packs/foundation/) |
| Actions | [`configs/governance/action-catalog.yaml`](configs/governance/action-catalog.yaml) |
| v2 replay | [`ontology/search/replay-search-index.ts`](ontology/search/replay-search-index.ts) |
| v2 lakehouse | [`data-platform/lakehouse/silver-writer.ts`](data-platform/lakehouse/silver-writer.ts) |
| Runtime wiring | [`api/gateway/src/platform/daemon-runtime.ts`](api/gateway/src/platform/daemon-runtime.ts) |
