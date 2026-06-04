# Lakehouse (Postgres)

| Layer | Table / view | Write path | Read path |
|-------|----------------|------------|-----------|
| Bronze | `daemon_lakehouse_bronze` | Propagation `lakehouse-bronze` (append) | `GET /v1/lakehouse/events`, `GET /v1/lakehouse/summary` (bronze aggregations) |
| Silver | `daemon_lakehouse_silver_entity` | Propagation `lakehouse-silver` (upsert) | — |
| Gold | `daemon_lakehouse_gold_*` views | SQL over silver/bronze | `LakehouseReader` (optional gold rollups) |

Writers: `bronze-writer.ts`, `silver-writer.ts`. Readers: `bronze-reader.ts`, `lakehouse-reader.ts`. Analytics: `GET /v1/analytics/lakehouse-summary`.

Migrations: `004_lakehouse_bronze.sql`, `006_lakehouse_silver_gold.sql`. GPT sessions: `005_gpt_sessions.sql` + `../product-sessions/gpt-session-store.ts`.

Parquet/object storage is deferred. See [docs/11-data-platform-lakehouse.md](../../docs/11-data-platform-lakehouse.md).
