# Testing

| Suite | Location | Approach |
|-------|----------|----------|
| Unit | package `*.test.ts`, Go `*_test.go`, Rust `#[test]` | In-process, no mocks for domain logic |
| Contract | `tests/contract/` | OpenAPI shape vs gateway |
| Integration | `tests/integration/` | docker-compose services |
| Policy | `tests/policy/` | YAML fixtures + Rust `PolicyEngine` |
| Ontology | `tests/ontology/` | Registry round-trip |
| E2E | `tests/e2e/` | ingest → read → write path |
| Read parity | `read-write-loops/reads/read-parity*.test.ts`, `read-router.test.ts` | Registry vs projection comparison; `node scripts/measure-read-projection-parity.mjs` |

Integration and e2e do not use `jest.mock` or in-memory fake databases unless `DAEMON_USE_EMBEDDED=1` for local-only dev.

## Local integration stack

```bash
pnpm run dev:up
# or: pnpm exec daemon-cli dev up   (requires @daemon/cli linked at repo root)
# or: docker compose -f deployment/docker/compose.dev.yaml up -d
export DAEMON_REDIS_URL=redis://127.0.0.1:6379
export DAEMON_INTEGRATION_REQUIRED=1
# Migrations (superuser — creates tables + daemon_app role)
DAEMON_POSTGRES_URL=postgresql://daemon:daemon@127.0.0.1:5432/daemon pnpm run db:migrate
# Runtime + integration tests (RLS-enforced app role)
export DAEMON_POSTGRES_URL=postgresql://daemon_app:daemon_app@127.0.0.1:5432/daemon
pnpm run test:repo
```

`tests/integration/gateway-http.test.ts` boots the Nest gateway in-process with a mock ingest HTTP server (in-memory ontology; it does not use `DAEMON_POSTGRES_URL` unless you pass it explicitly). It includes `POST /v1/ingest/sources/demo-parties/run` against `configs/collect-sensing/sources.yaml` and `tests/fixtures/ingest/parties.jsonl` when `DAEMON_REPO_ROOT` points at the repo (set automatically in that test). `tests/e2e/ingest-read-write-http.test.ts` runs the full HTTP chain when `DAEMON_INTEGRATION_REQUIRED=1`. Postgres integration tests skip when `DAEMON_POSTGRES_URL` is unset **or** when nothing is listening on that URL (for example compose is stopped but the variable remains in your shell).

### Gateway security tests

`tests/integration/gateway-security.test.ts` asserts fail-closed auth on the in-process gateway:

- `GET /v1/read/entities` and `GET /v1/search` return **401** without credentials.
- Session-backed routes return **403** when `X-Daemon-Tenant` does not match the API key tenant.
- Webhook ingest returns **401/503** when HMAC is required but `DAEMON_WEBHOOK_HMAC_SECRET` is unset.
- `POST /v1/policy/check` requires authentication.

CI runs `pnpm run check:route-auth` to ensure every controller route declares `@Public`, `@Protected`, `@WebhookAuth`, or `@PolicyCheck`.

To exercise source-run locally without upstream Go:

```bash
export DAEMON_INGEST_SKIP_UPSTREAM=1
export DAEMON_REPO_ROOT="$(pwd)"
curl -sS -X POST http://127.0.0.1:3000/v1/ingest/sources/demo-parties/run \
  -H "content-type: application/json" \
  -H "x-api-key: daemon-dev-key" \
  -H "x-tenant-id: inst-alpha" \
  -H "x-domain-id: foundation"
```

### ABC Express shadow ingest (Antero read-only)

Fixture parity (CI/local, no upstream credentials):

```bash
export DAEMON_ABC_FIXTURES=1
export DAEMON_INTEGRATION_REQUIRED=1
pnpm exec node --test tests/integration/antero-shadow-parity.integration.test.ts
```

Live shadow pull from Antero Supabase (read-only role; secrets via env only):

```bash
export DAEMON_POSTGRES_URL=postgresql://daemon_app:daemon_app@127.0.0.1:5432/daemon
export ANTERO_SUPABASE_DB_URL=postgresql://...   # read-only session pooler
export DAEMON_ABC_LIVE_INGEST=1
export DAEMON_API_KEY=daemon-dev-key

curl -sS -X POST http://127.0.0.1:3000/v1/ingest/sources/abc-antero-pos-ttk/run \
  -H "content-type: application/json" \
  -H "x-api-key: $DAEMON_API_KEY" \
  -H "x-daemon-tenant: abc-antero" \
  -H "x-daemon-domain: logistics"
```

Validate with `GET /v1/read/entities?ontologyId=foundation&entityType=TTK`. Sources are defined in `configs/collect-sensing/sources.abc-express.yaml` (`abc-antero-*`).

## Database migrations and durability

Apply versioned SQL before integration tests or gateway boot with Postgres:

```bash
DAEMON_POSTGRES_URL=postgresql://daemon:daemon@127.0.0.1:5432/daemon pnpm run db:migrate
```

Use `daemon_app` for gateway and `test:repo` after migrate (`postgresql://daemon_app:daemon_app@127.0.0.1:5432/daemon`). The compose user `daemon` is a superuser and bypasses row-level security.

Migrations live in `data-platform/migrations/` (`daemon_audit`, `daemon_entity_snapshots`, `daemon_graph_edges`). `initDaemonRuntime()` runs migrations when `DAEMON_POSTGRES_URL` is set, replays entity snapshots into an in-memory registry, and wraps writes with `DurableOntologyStore` (write-through journal).

| Test | Purpose |
|------|---------|
| `tests/integration/stores.integration.test.ts` | ping + `daemon_entity_snapshots` exists after migrate |
| `tests/integration/audit-postgres.integration.test.ts` | `tenantId`, `domainId`, `metadata` round-trip |
| `tests/integration/ontology-durability.integration.test.ts` | register → journal → `replayInto` empty registry |
| `ontology/store/durable-ontology-store.test.ts` | in-memory journal fake (unit) |

CI runs an `integration` job with service containers and the same env vars.

## Neo4j and natural-language query

Local stack includes Neo4j 5 when using `pnpm run dev:up`:

```bash
export DAEMON_NEO4J_URI=bolt://127.0.0.1:7687
export DAEMON_NEO4J_USER=neo4j
# Match your local compose stack — do not commit real credentials
export DAEMON_NEO4J_PASSWORD="${DAEMON_NEO4J_PASSWORD:?set from .env or dev:up compose}"
# Optional read-only role for query execution (defaults to credentials above)
# export DAEMON_NEO4J_QUERY_USER=...
# export DAEMON_NEO4J_QUERY_PASSWORD=...
# export DAEMON_NEO4J_QUERY_TIMEOUT_MS=5000
# export DAEMON_NEO4J_MAX_ROWS=100
```

Backfill Postgres snapshots into Neo4j (after migrate):

```bash
DAEMON_POSTGRES_URL=postgresql://daemon:daemon@127.0.0.1:5432/daemon \
  pnpm exec daemon-cli graph backfill-neo4j --tenant-id default --domain-id foundation
```

Enable gateway NL query (`POST /v1/query/ask`):

```bash
export DAEMON_ONTOLOGY_QUERY_ENABLED=1
export OPENROUTER_API_KEY=<your-key>
export DAEMON_ONTOLOGY_QUERY_MODEL=anthropic/claude-sonnet-4.5
```

| Test | Purpose |
|------|---------|
| `ontology/graph-schema/pack-graph-schema.test.ts` | Pack → Neo4j constraints + LLM schema summary |
| `products/ontology-query/validate-cypher.test.ts` | Read-only Cypher guard |
| `tests/integration/ontology-neo4j-sync.integration.test.ts` | Propagation sync upsert (gated) |
| `tests/integration/ontology-query.integration.test.ts` | LangGraph chain with mock LLM (gated) |
| `products/shared/openrouter-model.test.ts` | OpenRouter factory env (`data_collection: deny` default) |
| `api/gateway/src/streaming/sse.test.ts` | SSE framing round-trip |
| `products/agent-worker/daemon-tools.test.ts` | Read-only agent tool allowlist |
| `products/agent-orchestrator/router.test.ts` | Supervisor intent routing heuristics |
| `tests/integration/agent-worker.integration.test.ts` | Gateway agent session run (no OpenRouter) |
| `tests/integration/gateway-security.test.ts` | Stream endpoints require credentials |

Neo4j integration tests skip unless Bolt is reachable (`skipUnlessNeo4jReady` in `tests/helpers/neo4j-integration.ts`). No OpenRouter key is required in CI for ontology-query tests (mock LLM).

### Streaming LLM (SSE)

Gateway stream routes (require auth + policy):

- `POST /v1/query/ask/stream`
- `POST /v1/products/customer-gpt/chat/stream`
- `POST /v1/agents/sessions/:id/stream`

Sync counterparts remain for backward compatibility. Local dev without `OPENROUTER_API_KEY` still returns deterministic customer-GPT and agent `rag_chat` paths.

```bash
curl -N -H "X-Api-Key: daemon-dev-key" -H "Content-Type: application/json" \
  -d '{"turns":[{"role":"user","content":"hello"}]}' \
  http://localhost:3000/v1/products/customer-gpt/chat/stream
```

SDK: `customerGptChatStream`, `queryAskStream`, `agentSessionStream` on `DaemonClient` (see `packages/sdk/src/sse.ts`).
