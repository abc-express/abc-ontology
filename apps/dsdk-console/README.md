# DSDK Console

Minimal enterprise web shell for daemon-sdk: Connect, Pipeline, Ontology, Lakehouse, and AIP modules. Uses `@daemon/sdk` against the NestJS gateway.

## Run locally

```bash
# From repo root
pnpm install
pnpm run dev:gateway   # terminal 1 — http://localhost:3000

cd apps/dsdk-console
pnpm run dev           # terminal 2 — http://localhost:5173 (proxies /api → gateway)
```

Set in the UI or via env (Vite):

- Gateway base URL (default proxied `/api` → `http://localhost:3000`)
- `X-Daemon-Tenant` / `X-Daemon-Domain` (e.g. `logistics-pilot` / `logistics`)
- API key (`daemon-dev-key` from `.env.example`)

## Build

```bash
pnpm --filter @daemon/dsdk-console build
```

Static assets can be served behind the same host as the gateway or a CDN.

## Scope

This is a **DSDK-native** console, not a Foundry Workshop/OSDK clone. It exercises production E2E APIs from the gap implementation plan (schedules, webhooks, data-health, exports, pipelines, evals).
