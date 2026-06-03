# Testing

| Suite | Location | Approach |
|-------|----------|----------|
| Unit | package `*.test.ts`, Go `*_test.go`, Rust `#[test]` | In-process, no mocks for domain logic |
| Contract | `tests/contract/` | OpenAPI shape vs gateway |
| Integration | `tests/integration/` | docker-compose services |
| Policy | `tests/policy/` | YAML fixtures + Rust `PolicyEngine` |
| Ontology | `tests/ontology/` | Registry round-trip |
| E2E | `tests/e2e/` | ingest → read → write path |

Integration and e2e do not use `jest.mock` or in-memory fake databases unless `DAEMON_USE_EMBEDDED=1` for local-only dev.

## Local integration stack

```bash
pnpm run dev:up
# or: pnpm exec daemon-cli dev up   (requires @daemon/cli linked at repo root)
# or: docker compose -f deployment/docker/compose.dev.yaml up -d
export DAEMON_POSTGRES_URL=postgresql://daemon:daemon@127.0.0.1:5432/daemon
export DAEMON_REDIS_URL=redis://127.0.0.1:6379
export DAEMON_INTEGRATION_REQUIRED=1
pnpm run test:repo
```

`tests/integration/gateway-http.test.ts` boots the Nest gateway in-process with a mock ingest HTTP server. `tests/e2e/ingest-read-write-http.test.ts` runs the full HTTP chain when `DAEMON_INTEGRATION_REQUIRED=1`. Postgres audit and store tests skip without `DAEMON_POSTGRES_URL` / `DAEMON_REDIS_URL`.

CI runs an `integration` job with service containers and the same env vars.
