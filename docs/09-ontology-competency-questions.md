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
| LQ-05 | What **TTK** document belongs to shipment `{shipmentId}`? | `Shipment` → `LINK` → `TTK` (exactly one per OM Bab 5) |
| LQ-06 | List shipments with status `{status}` | Filter `Shipment` by `status` |
| LQ-07 | How many links does shipment `{shipmentId}` have? | Count `LINK` from `Shipment` |

## Logistics-commercial extension (domain `logistics`, P0 continued)

| ID | Question (natural language) | Expected graph pattern |
|----|----------------------------|------------------------|
| LQ-08 | Which **Opportunity** records reference account `{accountId}`? | `Opportunity` with `accountRef` or `LINK` → `Account` |
| LQ-09 | What **Conversation** rows tie to account `{accountId}`? | `Conversation` with `accountRef` or `LINK` → `Account` |

## Logistics-commercial extension (domain `logistics`, P1 — pack v0.2.0+)

| ID | Question (natural language) | Expected graph pattern |
|----|----------------------------|------------------------|
| LQ-10 | Which **Lead** records reference account `{accountId}`? | `Lead` with `accountRef` or `LINK` → `Account` |
| LQ-11 | What **Pipeline** stage is account `{accountId}` in? | `Pipeline` with `accountRef` / `stage` filter |
| LQ-12 | List **Activity** rows for account `{accountId}` since `{date}` | `Activity` with `accountRef` and `occurredAt` |
| LQ-13 | Which **AccountPlan** covers account `{accountId}` for period `{period}`? | `AccountPlan` with `accountRef` / `period` |
| LQ-14 | What **Signal** rows exist for account `{accountId}` at stage `{stage}`? | `Signal` with `accountRef` / `stage` |
| LQ-15 | Which **Trip** has code `{tripCode}`? | Match `Entity:Trip` by `tripCode` or `entityId` |
| LQ-16 | What **Dispatch** rows reference manifest `{manifestId}`? | `Dispatch` with `manifestRef` or `LINK` → `Manifest` |
| LQ-17 | List **RoutingDecision** rows for shipment `{shipmentId}` | `RoutingDecision` with `shipmentRef` |

## Logistics-commercial extension (domain `logistics`, v0.3.0 — Antero alignment)

| ID | Question (natural language) | Expected graph pattern |
|----|----------------------------|------------------------|
| LQ-18 | What **Evidence** rows exist for TTK `{noTtk}` across manifest and POD contexts? | `TTK` → `LINK` → `Evidence` or filter `ttkRef` / `noTtk` |
| LQ-19 | What **Shipments** (and their TTKs) link to pickup request `{pickupId}`? | `PickupRequest` ↔ `Shipment` via `PickupShipment`; each Shipment → one `TTK` |
| LQ-20 | Which **Manifest** rows belong to trip `{tripCode}`? | `Trip` with `tripCode` → `Manifest` via `tripRef` |
| LQ-21 | Which **RegionalOffice** is the selling RO for TTK `{ttkId}`? | `TTK.sellingRoRef` → `RegionalOffice` or `LINK` |
| LQ-22 | Which **Project** contains TTK `{ttkId}`? | `TTK.projectRef` → `Project` or `LINK` |

Pack resolution supports `packBranch` / `environment` query params on `GET /v1/ontology/pack-resolution` (see [17-platform-decision-map.md](./17-platform-decision-map.md)).

### Negative competency (logistics domain, v1)

Do **not** claim answers (return empty or explain out-of-scope) for:

- TP-engine pricing outputs, shadow-before-go-live rating, **`allocatedVendorCost`** / NLM dollar amounts on ShipmentLeg or Shipment
- **Vendor** entity rates (deferred — `vendorRef` string only on Trip)
- Financial journal entries, cost-center profitability, Layer 6+ people/performance entities
- Accurate sync, Sartrans pool payloads, Installer module entities
- Live operational KPIs (uptime %, adoption) — remain in downstream operational SSOT

Operational execution state and downstream operational decision outputs are not replaced by NL query; DAEMON holds semantic registration and read projection only.

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
