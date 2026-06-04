# DAEMON (daemon-sdk)

End-to-end ontology platform monorepo (TypeScript gateway, Go collect-sensing, Rust security). Primary local dev: `pnpm run dev:gateway` (NestJS on port 3000), API key `daemon-dev-key` from `.env.example`.

- Overview: [docs/00-overview.md](docs/00-overview.md)
- Bounded contexts: [docs/02-bounded-contexts.md](docs/02-bounded-contexts.md)
- Ontology system: [docs/02-ontology-system.md](docs/02-ontology-system.md)
- Testing: [docs/06-testing.md](docs/06-testing.md)

Gateway rule: do not import `globalRegistry` or `CommandGateway` from controllers/services — use `DaemonRuntime` (`api/gateway/src/platform/daemon-runtime.ts`). Enforced by `pnpm run check:architecture`.

Full learning history with dates and file refs: [.superstack/learnings.md](.superstack/learnings.md).

## Learnings

Key patterns, pitfalls, and preferences from repo bootstrap (2026-06-04). See `.superstack/learnings.md` for append-only history.

### Architecture
- **gateway-composition-root:** HTTP flows compose through `DaemonRuntime`; no direct `globalRegistry` / `CommandGateway` in gateway services (9/10)
- **bounded-context-boundaries:** Ingest in collect-sensing; truth in ontology; governed writes in read-write-loops (9/10)
- **postgres-durable-ssot:** `DAEMON_POSTGRES_URL` enables migrations, durable journal, registry replay, and search replay on boot (9/10)

### Patterns
- **tenant-domain-headers:** Use `X-Daemon-Tenant` and `X-Daemon-Domain` for scope (8/10)
- **propagation-on-write:** Register/patch triggers `PropagationExecutor` targets from `configs/governance/propagation.yaml` (8/10)
- **search-replay-on-boot:** `replaySearchIndex` rebuilds hybrid search from journal without re-ingest (9/10)
- **ingest-before-automation:** Ingest entities before automations or targeted reads (`NOT_FOUND` otherwise) (9/10)
- **dev-skip-upstream-services:** `DAEMON_INGEST_SKIP_UPSTREAM` / `DAEMON_POLICY_SKIP_UPSTREAM` for local gateway without Go services (8/10)

### Pitfalls
- **replay-skips-propagation:** Search replay does not re-run propagation (avoids duplicate lakehouse rows) (9/10)
- **init-vs-get-runtime:** `getDaemonRuntime()` alone skips Postgres durability and search replay (8/10)
- **embedding-provider-restart:** Changing embedding provider/model requires gateway restart for consistent replay (8/10)

### Preferences
- **no-jest-mock-integration:** Integration/e2e avoid `jest.mock` unless `DAEMON_USE_EMBEDDED=1` (8/10)
- **deterministic-embeddings-default:** Default deterministic embedder for CI/local without API keys (8/10)

### Tools
- **check-architecture-ci:** `pnpm run check:architecture` guards gateway boundary imports (9/10)
- **integration-needs-postgres:** `test:repo` integration tests need reachable `DAEMON_POSTGRES_URL` and `daemon_app` after migrate (8/10)
