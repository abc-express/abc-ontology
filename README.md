# daemon-sdk

End-to-end ontology platform monorepo (architecture derived from four-layer AIP / ontology / read-write / language-engine diagrams). The repository root is the product tree; there is no nested `daemon-ontology-platform/` folder.

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
pnpm install
docker compose -f deployment/docker/compose.dev.yaml up -d
pnpm run build
pnpm run test
make dev-gateway   # NestJS on :3000
```

Go: `go work sync && go test ./collect-sensing/...`

Rust: `cargo test --workspace`

## Documentation

- [Overview](docs/00-overview.md)
- [End-to-end architecture](docs/01-end-to-end-architecture.md)
- [Original spec reference](docs/reference/perplexity-architecture-spec.md)

## License

UNLICENSED — private monorepo unless otherwise configured for npm publish.
