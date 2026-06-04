# Products layer

Gateway-facing product modules compose through `ProductRuntime` (from `DaemonRuntime`). Route new operations via [product-shell/product-router.ts](./product-shell/product-router.ts); do not import `globalRegistry` or `CommandGateway` from product code.

## Product router (`ProductId`)

| Product | Module | Typical HTTP / SDK |
|---------|--------|-------------------|
| `analytics-workflows` | [analytics-workflows/](./analytics-workflows/) | Analytics controller, hybrid search |
| `customer-gpt` | [customer-gpt/](./customer-gpt/) | `POST /v1/products/customer-gpt/chat`, `DaemonClient.customerGptChat` |
| `automations` | [automations/](./automations/) | `POST /v1/automations/*` |
| `internal-applications` | [internal-applications/](./internal-applications/) | Dashboard snapshot ops |
| `admin-console` | [admin-console/](./admin-console/) | List entities admin op |

## Related packages (not `ProductId`)

| Package | Gateway surface |
|---------|-----------------|
| [ontology-query/](./ontology-query/) | `POST /v1/query/ask`, `DaemonClient.queryAsk` (LangGraph competency / Neo4j) |

## Documentation

- [docs/18-enterprise-platform-map.md](../docs/18-enterprise-platform-map.md) — Foundry-style application analogues
- [docs/17-platform-decision-map.md](../docs/17-platform-decision-map.md) — Logic / Actions vs products
- [docs/13-sdk.md](../docs/13-sdk.md) — `@daemon/sdk` client methods
