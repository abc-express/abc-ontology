# Ontology competency questions (NL graph query)

These questions define what the natural-language ontology query path (`POST /v1/query/ask`) must support in v1. Each question maps to Cypher over the Neo4j read model documented in [10-neo4j-graph-model.md](./10-neo4j-graph-model.md).

## Scope

- Pack: `foundation` ([`configs/ontology/packs/foundation/`](../configs/ontology/packs/foundation/))
- Tenancy: every answer is scoped to the caller's `tenantId` and `domainId` (never cross-tenant).
- Execution: read-only Cypher with row limits and timeouts.

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
