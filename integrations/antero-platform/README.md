# ANTERO platform — Fase A DAEMON consumer

Reference Next.js app for read-only DAEMON integration. Lives in the DAEMON monorepo until the dedicated `antero-platform` GitHub repo is available; copy this folder wholesale when ready.

## Quick start

```bash
# From repo root — build SDK first
pnpm --filter @daemon/sdk build

cd integrations/antero-platform
cp .env.example .env.local
# Edit .env.local with DAEMON_GATEWAY_URL and keys

pnpm install
pnpm dev
```

Open [http://localhost:3000/intelligence](http://localhost:3000/intelligence).

## Architecture

- **Server-only** `lib/daemon/client.ts` — `createAnteroDaemonClient("viewer" | "analyst")`
- **BFF** `app/api/daemon/*` — no client-supplied API keys
- **UI** calls BFF only via `lib/daemon/hooks.ts`

See [docs/integrations/antero-platform-fase-a.md](../../docs/integrations/antero-platform-fase-a.md) for staging deploy, Vercel env, and RBAC matrix.
