# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | Yes       |
| < 0.1   | No        |

## Reporting a vulnerability

Report security issues privately to **security@daemon.ai** (or your organization's security contact if this fork is internal).

Please include:

- Affected component (gateway, collect-sensing, policy engine, etc.)
- Steps to reproduce
- Impact assessment (confidentiality, integrity, availability)
- Any suggested fix or mitigation

We aim to acknowledge reports within **3 business days** and provide a severity assessment within **10 business days**. Critical issues affecting tenant isolation or authentication may receive expedited patches.

Do not open public GitHub issues for undisclosed vulnerabilities.

## Static analysis (Snyk)

We run [Snyk](https://snyk.io) Open Source and Code scans in CI. Triage notes:

| Finding class | Treatment |
|---------------|-----------|
| GraphQL ReDoS / introspection | Query length, depth, and body limits; introspection disabled when `NODE_ENV=production` (`api/graphql/src/validation.ts`). |
| Server error leakage | Gateway, GraphQL, and REST return generic `internal server error` for unexpected 500s; details logged server-side only. |
| Hardcoded dev API keys | Production paths require `DAEMON_API_KEYS` or `VITE_DAEMON_API_KEY`; dev inject uses `DAEMON_API_KEY` from env (see `.env.example`). |
| Nest webhook metadata key | `WEBHOOK_AUTH_KEY` is a `Symbol.for(...)` route marker, not a credential (`webhook-auth.decorator.ts`). |
| Test / script credentials | Ephemeral keys in `tests/helpers/test-api-keys.ts`; `.snyk` excludes `tests/**` and `scripts/**`. |
| Local HTTP listeners | GraphQL/REST/WebSocket dev servers bind plain HTTP for local use; production terminates TLS at the ingress/proxy (`docs/04-deployment.md`). |

Report false positives or policy gaps to **security@daemon.ai** with the Snyk rule ID and file path.

## Secure deployment

See [docs/04-deployment.md](docs/04-deployment.md) for production environment requirements (API keys, webhook HMAC, policy engine URL, OIDC settings).
