# Fase A — ANTERO platform as DAEMON read-only consumer

This guide covers staging gateway setup, SDK usage, BFF integration in `integrations/antero-platform/`, and Vercel environment variables for ops handoff.

## Scope

| Dimension | Value |
|-----------|--------|
| Tenant | `abc-antero` |
| Domain | `logistics` |
| Ontology | `foundation` |
| Pack | `logistics-commercial` (ABC Express fixtures) |

## RBAC matrix (staging keys)

Configured in `configs/governance/rbac.yaml` and bound via `DAEMON_API_KEYS`:

| Role | Gateway actions | Fase A endpoints |
|------|-----------------|------------------|
| `logistics-viewer` | `read`, `query` | list/read entities, search, queryAsk, shadow-pricing |
| `commercial-analyst` | `read`, `query`, `chat` | above + customer GPT, agent sessions |

**Never expose API keys to the browser.** ANTERO uses Next.js Route Handlers under `/api/daemon/*` only.

### Staging API key format

```
DAEMON_API_KEYS=<viewer-key>:antero-bff:abc-antero:logistics-viewer,<analyst-key>:antero-aip:abc-antero:commercial-analyst
```

Generate keys: `openssl rand -hex 32`

## 1. Deploy staging gateway

Follow the **Standard** profile in [docs/20-deployment-go-live-guide.md](../20-deployment-go-live-guide.md).

1. Provision Postgres 16 and run migrations:

   ```bash
   DAEMON_POSTGRES_URL=postgresql://... pnpm run db:migrate
   ```

2. Copy [deployment/staging/abc-antero.env.example](../deployment/staging/abc-antero.env.example) to your host/Railway/K8s secrets.

3. Set at minimum:

   - `DAEMON_AUTH_MODE=prod`
   - `DAEMON_POSTGRES_URL`
   - `DAEMON_REPO_ROOT` (container path to repo root)
   - `DAEMON_API_KEYS` (viewer + analyst keys above)
   - `DAEMON_ABC_FIXTURES=1`

4. Optional for NL query / AIP:

   - `DAEMON_ONTOLOGY_QUERY_ENABLED=1`
   - `DAEMON_NEO4J_URI`, credentials
   - `OPENROUTER_API_KEY`, `DAEMON_ONTOLOGY_QUERY_MODEL`

5. Start gateway and bootstrap fixtures:

   ```bash
   DAEMON_GATEWAY_URL=https://<staging-host> \
   DAEMON_STAGING_API_KEY=<admin-or-analyst-key> \
   pnpm run staging:bootstrap-abc
   ```

6. Run consumer smoke:

   ```bash
   DAEMON_GATEWAY_URL=https://<staging-host> \
   DAEMON_STAGING_VIEWER_API_KEY=<viewer-key> \
   DAEMON_STAGING_ANALYST_API_KEY=<analyst-key> \
   DAEMON_STAGING_SMOKE_REQUIRE_GATEWAY=1 \
   pnpm run staging:consumer-smoke
   ```

Record the public URL as **`DAEMON_GATEWAY_URL`** for Vercel.

## 2. SDK (`@daemon/sdk`)

Install from registry or link from this monorepo:

```json
"@daemon/sdk": "file:../../packages/sdk"
```

Fase A methods:

- `listEntities`, `readEntity`, `search`
- `queryAsk`, `queryAskStream`
- `shadowPricingSimulate` (POST `/v1/products/shadow-pricing/simulate`)
- `customerGptChat`, `customerGptChatStream`
- `createAgentSession`, `agentSessionRun`, `agentSessionStream`

Example (server-only):

```typescript
import { DaemonClient } from "@daemon/sdk";

const client = new DaemonClient({
  baseUrl: process.env.DAEMON_GATEWAY_URL!,
  apiKey: process.env.DAEMON_API_KEY!,
  tenantId: "abc-antero",
  domainId: "logistics",
});

const page = await client.listEntities({
  ontologyId: "foundation",
  entityType: "Shipment",
  limit: 50,
});
```

## 3. ANTERO BFF routes

Reference implementation: [integrations/antero-platform/](../../integrations/antero-platform/)

| BFF route | SDK method | Key role |
|-----------|------------|----------|
| `GET /api/daemon/entities` | `listEntities` | viewer |
| `GET /api/daemon/entities/[id]` | `readEntity` | viewer |
| `GET /api/daemon/search` | `search` | viewer |
| `POST /api/daemon/query/ask` | `queryAsk` | viewer |
| `POST /api/daemon/query/ask/stream` | `queryAskStream` | viewer |
| `POST /api/daemon/shadow-pricing/simulate` | `shadowPricingSimulate` | viewer |
| `POST /api/daemon/gpt/chat` | `customerGptChat` | **analyst** |
| `POST /api/daemon/gpt/chat/stream` | `customerGptChatStream` | analyst |
| `POST /api/daemon/agents/sessions` | `createAgentSession` | analyst |
| `POST /api/daemon/agents/sessions/[id]/run` | `agentSessionRun` | analyst |
| `POST /api/daemon/agents/sessions/[id]/stream` | `agentSessionStream` | analyst |

UI shell: `/intelligence` — entity explorer, search, ask, GPT, shadow pricing.

## 4. Vercel environment checklist

Set in **Project → Settings → Environment Variables** (Preview + Production as needed):

| Variable | Required | Notes |
|----------|----------|-------|
| `DAEMON_GATEWAY_URL` | Yes | Staging gateway HTTPS URL |
| `DAEMON_API_KEY` | Yes | `commercial-analyst` key |
| `DAEMON_VIEWER_API_KEY` | Recommended | `logistics-viewer` key for read/query routes |
| `DAEMON_TENANT_ID` | Yes | `abc-antero` |
| `DAEMON_DOMAIN_ID` | Yes | `logistics` |
| `DAEMON_ONTOLOGY_ID` | Yes | `foundation` |

Do **not** prefix with `NEXT_PUBLIC_`. Rotate keys via `DAEMON_API_KEYS` on gateway and update Vercel secrets together.

## 5. Verification

| Check | Expected |
|-------|----------|
| `GET /api/daemon/entities?entityType=Shipment` | ≥1 item after fixture bootstrap |
| Search `Shipment` | Non-empty hits |
| Shadow pricing `SHP-ABC-001` | `readOnly: true`, `shipments.count >= 1` |
| GPT with viewer key (direct gateway) | HTTP 403 |
| GPT via BFF (analyst key) | 200 or 503 if LLM unset |

Golden reference: [tests/fixtures/abc-express/golden-summary.json](../../tests/fixtures/abc-express/golden-summary.json)

## 6. Ops handoff

- **Key rotation:** generate new hex keys, update `DAEMON_API_KEYS` on gateway, then Vercel env vars; redeploy both.
- **Neo4j/LLM:** optional; UI should tolerate 503 on query/GPT when graph or OpenRouter is off.
- **Fixture refresh:** re-run `pnpm run staging:bootstrap-abc` after gateway reset.
- **Promote to dedicated repo:** copy `integrations/antero-platform/` to the org `antero-platform` repo when available.

## curl examples (server-side debugging)

Replace placeholders; never commit real keys.

```bash
export GW=https://staging-gateway.example.com
export KEY_VIEWER=...
export KEY_ANALYST=...

curl -s "$GW/v1/read/entities?ontologyId=foundation&entityType=Shipment&limit=5" \
  -H "x-api-key: $KEY_VIEWER" \
  -H "x-daemon-tenant: abc-antero" \
  -H "x-daemon-domain: logistics"

curl -s -X POST "$GW/v1/products/shadow-pricing/simulate" \
  -H "content-type: application/json" \
  -H "x-api-key: $KEY_VIEWER" \
  -H "x-daemon-tenant: abc-antero" \
  -H "x-daemon-domain: logistics" \
  -d '{"ontologyId":"foundation","shipmentRef":"SHP-ABC-001"}'
```
