# Connectors catalog

## Supported types (v1)

| Type | Module | Notes |
|------|--------|-------|
| `file` | `file-connectors` | JSONL/CSV from repo-relative paths |
| `http-pull` | `api-connectors` | REST fetch; gateway supplies `fetch` by default |
| `postgres-read` | `db-connectors` | SQL via shared `DAEMON_POSTGRES_URL` executor |
| `event-subscriber` | `event-connectors` | Requires injected subscription in tests |
| `s3` | `file-connectors` | List prefix; JSONL/CSV objects (AWS SDK v3 / MinIO-compatible) |
| `kafka` | `event-connectors` | Consumer batch via `kafkajs`; topic → records with idempotent `recordId` |

Metadata lives in `configs/collect-sensing/connectors-catalog.yaml`. Source instances are in `configs/collect-sensing/sources.yaml`.

### Scheduled ingest and webhooks

- `GET/POST/PATCH /v1/ingest/schedules` — cron-driven runs (gateway poll; `DAEMON_INGEST_SCHEDULE_POLL_SECONDS`, default 60s).
- `POST /v1/ingest/webhooks/:sourceId` — HMAC optional (`DAEMON_WEBHOOK_HMAC_SECRET`, header `X-Daemon-Signature`).

### Collect agent (Pattern B)

CLI `daemon-agent push` in `toolchain/collect-agent/` — local JSONL/JSON → `POST /v1/ingest/records`.

## Validation

```bash
pnpm run check:sources
```

## Ingest path

Gateway `IngestPipelineService` builds connectors via `createConnectorForSource` with:

- `queryExecutor` when Postgres is configured
- `httpFetch: globalThis.fetch` for `http-pull`

Run a catalog source: `POST /v1/ingest/sources/:sourceId/run` with tenant/domain headers.

SDK ingest methods and connectivity topologies: [13-sdk.md](./13-sdk.md), [15-data-connection-map.md](./15-data-connection-map.md). Data integration map: [14-data-integration-map.md](./14-data-integration-map.md).

## Deferred

- Enterprise ERP connectors (SAP, Snowflake) — catalog entries only after factory support
- Private link / VPC endpoints — infra-specific ([15-data-connection-map.md](./15-data-connection-map.md))
