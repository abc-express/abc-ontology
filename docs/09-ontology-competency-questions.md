# Ontology competency questions (NL graph query)

These questions define what the natural-language ontology query path (`POST /v1/query/ask`) must support in v1. Each question maps to Cypher over the Neo4j read model documented in [10-neo4j-graph-model.md](./10-neo4j-graph-model.md).

## Scope

- **Foundation domain** — pack `foundation` only ([`configs/ontology/packs/foundation/`](../configs/ontology/packs/foundation/)).
- **Logistics domain** — merged `foundation` + extension `logistics-commercial` when `domainId=logistics` and the tenant enables that domain ([`configs/ontology/domains/catalog.yaml`](../configs/ontology/domains/catalog.yaml)).
- Tenancy: every answer is scoped to the caller's `tenantId` and `domainId` (never cross-tenant).
- Execution: read-only Cypher with row limits and timeouts.

NL query on `domainId=foundation` must **not** answer logistics-commercial questions (no `Shipment`, `Account`, etc. in the schema summary for that domain).

## Competency questions

| ID | Question (natural language) | Expected graph pattern |
|----|----------------------------|------------------------|
| CQ-01 | Which parties are linked to case `{caseId}`? | Match `Case` node → `LINK` → `Party` |
| CQ-02 | What entities are directly linked to `{entityId}`? | 1-hop `LINK` from any `Entity` |
| CQ-03 | What is the shortest path between party `{fromId}` and party `{toId}`? | `shortestPath` on `LINK` between two nodes |
| CQ-04 | List cases with status `{status}` for this tenant | Filter `Case` by `status` property |
| CQ-05 | How many links does case `{caseId}` have? | Count outgoing/incoming `LINK` |
| CQ-06 | Which organizations are linked to document `{docId}`? | `Document` → `LINK` → `Organization` |
| CQ-07 | List all links of type `{linkType}` involving party `{partyId}` | `LINK` with `linkType` filter |
| CQ-08 | Which cases are linked to event `{eventId}`? | `Event` ↔ `LINK` ↔ `Case` |
| CQ-09 | Find parties with `partyKind` `{kind}` that link to any open case | `Party` + `Case.status` filter via `LINK` |
| CQ-10 | What documents are linked to case `{caseId}`? | `Case` → `LINK` → `Document` |

## Logistics-commercial extension (domain `logistics`, P0)

Requires extension pack `logistics-commercial` merged for the caller's domain. Use type labels from the domain-aware schema summary (`Account`, `Shipment`, etc.).

| ID | Question (natural language) | Expected graph pattern |
|----|----------------------------|------------------------|
| LQ-01 | Which **Account** record has id `{accountId}`? | Match `Entity:Account` by `entityId` |
| LQ-02 | What **Contacts** reference account `{accountId}`? | `Account` → `LINK` → `Contact` (or property filter on `accountRef`) |
| LQ-03 | What **Shipments** belong to order `{orderId}`? | `Order` → `LINK` → `Shipment` or `orderRef` on `Shipment` |
| LQ-04 | Which **Manifest** rows connect to shipment `{shipmentId}`? | `Shipment` ↔ `Manifest` via `LINK` or shared junction membership in properties |
| LQ-05 | What **TTK** documents reference shipment `{shipmentId}`? | `Shipment` → `LINK` → `TTK` |
| LQ-06 | List shipments with status `{status}` | Filter `Shipment` by `status` |
| LQ-07 | How many links does shipment `{shipmentId}` have? | Count `LINK` from `Shipment` |

## Logistics-commercial extension (domain `logistics`, P1)

| ID | Question (natural language) | Expected graph pattern |
|----|----------------------------|------------------------|
| LQ-08 | Which **Opportunity** records reference account `{accountId}`? | `Opportunity` with `accountRef` or `LINK` → `Account` |
| LQ-09 | What **Conversation** rows tie to opportunity `{opportunityId}`? | `Conversation` with `opportunityRef` or `LINK` → `Opportunity` |

Pack resolution supports `packBranch` / `environment` query params on `GET /v1/ontology/pack-resolution` (see [17-platform-decision-map.md](./17-platform-decision-map.md)).

### Negative competency (logistics domain, v1)

Do **not** claim answers (return empty or explain out-of-scope) until later pack entities and graph scope exist:

- Transport-planning / **Trip** allocation, **Dispatch**, **RoutingDecision**
- **Signal** stages, TP-engine outputs, pipeline stages (**Lead**, **Pipeline**, etc.)
- Financial journal entries, cost-center profitability, chargeable-weight rules on **ShipmentLeg**

Operational KPIs and live execution state remain in downstream operational systems; DAEMON holds semantic registration and read projection only.

## Few-shot examples (for LLM prompts)

Use these as prompt examples in `@daemon/ontology-query` (not as automated tests unless copied into fixtures).

**CQ-01 example**

Question: Which parties are linked to case `case-42`?

```cypher
MATCH (c:Entity:Case { tenantId: $tenantId, domainId: $domainId, entityId: 'case-42' })
MATCH (c)-[r:LINK]->(p:Entity:Party)
WHERE r.tenantId = $tenantId AND r.domainId = $domainId
RETURN p.entityId AS partyId, p.displayName AS displayName, r.linkType AS linkType
LIMIT 50
```

**CQ-04 example**

Question: List cases with status `open`.

```cypher
MATCH (c:Entity:Case { tenantId: $tenantId, domainId: $domainId })
WHERE c.status = 'open'
RETURN c.entityId AS caseId, c.title AS title, c.status AS status
LIMIT 50
```

## Validation criteria

- Answers cite graph results (entity ids, link types), not invented records.
- Generated Cypher passes the read-only validator (no `CREATE`, `MERGE`, `SET`, `DELETE`, etc.).
- `$tenantId` and `$domainId` appear in every generated query.
