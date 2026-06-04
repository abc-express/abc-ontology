# DAEMON

End-to-end ontology platform monorepo (architecture derived from four-layer AIP / ontology / read-write / language-engine diagrams). The repository root is the product tree; there is no nested `daemon-ontology-platform/` folder.

**Remote:** [github.com/daemon-blockint-tech/DAEMON](https://github.com/daemon-blockint-tech/DAEMON)

## Quality bar

- **TypeScript**, **Go**, and **Rust** implementations — no stub handlers, no `jest.mock` in integration/e2e tests.
- **Bounded contexts**: ingest/normalize only in `collect-sensing`; semantic truth in `ontology`; mutations via `read-write-loops`.
- Publishable npm packages: `@daemon/platform-types`, `@daemon/sdk`, `@daemon/cli` (Changesets).

## Language map

| Area | Runtime |
|------|---------|
| `collect-sensing/` | Go |
| `ontology/registry`, graph/vector engines | Go + Rust |
| `read-write-loops/`, `action-runtime/`, `api/`, `products/` | TypeScript (NestJS gateway) |
| `security-governance/policy`, `engine/*` | Rust (+ Go/TS integration) |
| `toolchain/sdk/` | TypeScript, Go, Rust, Python |

## Quick start

```bash
cp .env.example .env   # optional; defaults work for local dev
pnpm install
pnpm run dev:up        # docker compose + build deps
pnpm run dev:gateway   # NestJS API on :3000 (skips upstream Go ingest/policy in dev)
```

Other useful commands:

```bash
pnpm run build
pnpm run test
pnpm run test:repo     # full repo tests (set DAEMON_INTEGRATION_REQUIRED=1 when stack is up)
make dev-gateway
```

Go: `go work sync && go test ./collect-sensing/...`

Rust: `cargo test --workspace`

### Dev API smoke (gateway)

Use header `x-api-key: daemon-dev-key` (see `.env.example`).

1. Register an entity via ingest (flat body):

```bash
curl -sS -X POST http://localhost:3000/v1/ingest/records \
  -H 'content-type: application/json' \
  -H 'x-api-key: daemon-dev-key' \
  -d '{"ontologyId":"default","entityId":"my-entity","payload":{"name":"demo"}}'
```

2. Run an automation against that entity:

```bash
curl -sS -X POST http://localhost:3000/v1/automations/run \
  -H 'content-type: application/json' \
  -H 'x-api-key: daemon-dev-key' \
  -d '{"steps":[{"id":"s1","action":"notify"}],"loop":{"ontologyId":"default","entityId":"my-entity","patch":{"status":"done"}}}'
```

Ingest must run before automations; otherwise the read path returns `404` with `{ "code": "NOT_FOUND" }`.

## Documentation

**Published site (Mintlify):** run `nvm use` (Node 22 per `.nvmrc`), then `cd mintlify && npx mint dev` → http://localhost:3000. Deploy path in the Mintlify dashboard: `/mintlify`. See [mintlify/README.md](mintlify/README.md).

**Engineering Markdown** (`docs/`):

- [Overview](docs/00-overview.md)
- [Bounded contexts](docs/02-bounded-contexts.md)
- [End-to-end architecture](docs/01-end-to-end-architecture.md)
- [Ontology system](docs/02-ontology-system.md)
- [Read-write loops](docs/03-read-write-loops.md)
- [Testing](docs/06-testing.md)
- [Deployment](docs/04-deployment.md)
- [Observability](docs/05-observability.md)
- [Security & governance](docs/05-security-governance.md)
- [Original spec reference](docs/reference/perplexity-architecture-spec.md)

## License

Apache-2.0 — see [LICENSE](LICENSE).
