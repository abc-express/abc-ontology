# Observability

## Package (`@daemon/observability`)

| Module | Path | Purpose |
|--------|------|---------|
| Logging | `observability/logging/structured-logger.ts` | JSON one-line logs (`service`, `level`, `message`, fields) |
| Metrics | `observability/metrics/http-metrics.ts` | In-process counters + Prometheus text via `globalHttpMetrics` |
| Evals | `observability/evals/eval-hooks.ts` | Agent/workflow quality events (`EvalRecorder`) |

## Runtime hooks

- **NestJS gateway**: `ObservabilityModule` — request middleware (log + metrics) and `GET /metrics`.
- **Standalone REST** (`api/rest`): same middleware pattern and `GET /metrics`.
- **Health**: `GET /health` on gateway and REST (liveness).

## Config artifacts

- **Prometheus alerts**: `observability/metrics/prometheus-rules.yaml` (`daemon-api-gateway`, ingest latency).
- **OTel collector**: `observability/tracing/otel-collector.yaml` — wired in `deployment/docker/compose.dev.yaml` (ports 4317/4318).
- **Grafana stub**: `observability/dashboards/gateway-overview.json`.

## Environment

`configs/environments/*.yaml` sets `observability.logLevel` and `observability.metrics`. Override log verbosity with `LOG_LEVEL=debug|info|warn|error`.

## Local stack

```bash
docker compose -f deployment/docker/compose.dev.yaml up -d
curl http://localhost:3000/metrics
```

Scrape `daemon_http_requests_total` and `daemon_http_request_duration_ms_*` from the gateway or REST process.
