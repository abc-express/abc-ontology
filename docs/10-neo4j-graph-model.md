# Neo4j graph model (foundation + extension packs)

Operational read model for natural-language graph queries. **SSOT** remains pack YAML; this document describes the Neo4j projection synced from Postgres and the write path. Extension domains (e.g. `logistics`) merge additional entity type labels at sync and NL-query time via `PackResolver`.

## Node model

| Element | Description |
|---------|-------------|
| Primary label | `Entity` — all ontology entities |
| Type label | Secondary label per `entityType` from the **resolved pack** for the request domain — foundation: `Party`, `Organization`, `Case`, `Event`, `Link`, `Document`; logistics extension (domain `logistics`, pack v0.3.0): `Account`, `Contact`, `Order`, `Shipment`, `TTK`, `Manifest`, `Trip`, `Dispatch`, `RoutingDecision`, `PickupRequest`, `Evidence`, `RegionalOffice`, `Project`, `Location`, `ServiceAreaCoverage`, plus commercial stubs (`Lead`, `Pipeline`, etc.) |
| Identity | Composite key: `tenantId`, `domainId`, `ontologyId`, `entityId` |
| Core properties | `entityType`, `version`, `updatedAt` plus pack fields copied from snapshot `properties` |

### Constraints (dev / ensureSchema)

```cypher
CREATE CONSTRAINT entity_scope_key IF NOT EXISTS
FOR (n:Entity)
REQUIRE (n.tenantId, n.domainId, n.ontologyId, n.entityId) IS NODE KEY;
```

Indexes (recommended):

```cypher
CREATE INDEX entity_type_scope IF NOT EXISTS FOR (n:Entity) ON (n.tenantId, n.domainId, n.entityType);
CREATE INDEX case_status IF NOT EXISTS FOR (n:Entity) ON (n.tenantId, n.domainId, n.status);
```

## Relationship model

| Type | Description |
|------|-------------|
| `LINK` | Directed link between two entities (foundation `Link` entity / relation) |

Relationship properties:

- `linkType` (string)
- `tenantId`, `domainId` (scope)
- `ontologyId` (link record ontology id)
- `linkEntityId` (optional — id of the Link entity row)

Endpoints use entity ids in node keys (`fromEntityId` / `toEntityId` from Link properties).

```cypher
MATCH (a:Entity { tenantId: $t, domainId: $d, entityId: $from })
MATCH (b:Entity { tenantId: $t, domainId: $d, entityId: $to })
MERGE (a)-[r:LINK { linkType: $linkType, tenantId: $t, domainId: $d }]->(b)
```

### Logistics junction patterns (v0.3.0)

| Junction | Graph pattern |
|----------|---------------|
| `ShipmentLeg` | `Shipment` ↔ `Manifest` (multi-leg operational) |
| `PickupShipment` | `PickupRequest` ↔ `Shipment` (1 pickup, N shipments) |
| `DispatchShipment` | `Dispatch` ↔ `TTK` (last-mile assignment) |

Commercial hierarchy (OM Bab 5): each `Shipment` links to exactly one `TTK` (`shipmentRef` / `LINK`). Multi-destination pickup expands to N Shipment nodes, not N TTKs on one Shipment.

## Sync sources

| Source | When |
|--------|------|
| Propagation `neo4j-graph-sync` | After register/patch (entities + links) |
| `neo4j-backfill` CLI | One-shot from `daemon_entity_snapshots` + `daemon_graph_edges` |

## Tenancy

- Sync writes scope on every node and relationship.
- Query layer always binds `$tenantId` and `$domainId` from gateway `TenantContextService`.
- Optional read-only Bolt user: `DAEMON_NEO4J_QUERY_USER` / password (falls back to admin creds in dev).
- Read-query limits: `DAEMON_NEO4J_QUERY_TIMEOUT_MS` (default `5000`), `DAEMON_NEO4J_MAX_ROWS` (default `100`). Cypher from the ontology-query chain is validated in `products/ontology-query/validate-cypher.ts` (max 16 384 characters, read-only, single statement, `$tenantId` / `$domainId` required).

## Dev stack

See [06-testing.md](./06-testing.md) for env vars. Neo4j runs in `deployment/docker/compose.dev.yaml` (Bolt `7687`, Browser `7474`).

## Backfill

```bash
DAEMON_NEO4J_URI=bolt://127.0.0.1:7687 \
DAEMON_NEO4J_USER=neo4j \
DAEMON_NEO4J_PASSWORD=daemon-dev-neo4j \
pnpm exec daemon-cli graph backfill-neo4j --tenant-id default --domain-id default
```

Idempotent: safe to re-run after enabling Neo4j on an existing Postgres journal.
