# Sequence flows

## Ingest → ontology

```mermaid
sequenceDiagram
  participant Src as DataSource
  participant CS as CollectSensing
  participant Ont as OntologyRegistry
  Src->>CS: raw event
  CS->>CS: normalize
  CS->>Ont: canonical entity upsert
```

## Read path

```mermaid
sequenceDiagram
  participant Client
  participant GW as NestGateway
  participant TC as TenantContext
  participant RT as DaemonRuntime
  participant RR as ReadRouter
  participant Ont as OntologyStore
  Client->>GW: GET /v1/read/entities/:id
  GW->>TC: resolve X-Daemon-Tenant/Domain
  GW->>RT: getEntity
  RT->>RR: route scoped
  RR->>Ont: get
  Ont-->>Client: entity JSON
```

## Write path

```mermaid
sequenceDiagram
  participant Client
  participant GW as NestGateway
  participant RT as DaemonRuntime
  participant LOOP as LoopOrchestrator
  participant Ont as OntologyStore
  participant AUD as AuditPort
  Client->>GW: POST /v1/write
  GW->>RT: runWriteLoop
  RT->>LOOP: execute
  LOOP->>Ont: patch
  alt committed and onCommitted in action-catalog
    RT->>RT: WorkflowOrchestrator (catalog steps)
    RT->>AUD: workflow.execute
  end
  RT->>AUD: record loop.write
  Ont-->>Client: writeId, version, workflowResults
```

## Durable write (Postgres journal)

When `DAEMON_POSTGRES_URL` is configured, `DurableOntologyStore` mirrors each mutation to `daemon_entity_snapshots` after updating the in-memory registry.

```mermaid
sequenceDiagram
  participant GW as NestGateway
  participant DOS as DurableOntologyStore
  participant REG as OntologyRegistry
  participant PG as Postgres
  Note over GW,PG: On boot: replay journal into REG
  GW->>DOS: register / patch
  DOS->>REG: sync update
  DOS->>PG: upsert snapshot
```

## Ingest via gateway (pre-shaped records)

```mermaid
sequenceDiagram
  participant Client
  participant GW as NestGateway
  participant RT as DaemonRuntime
  participant GOV as Governance
  participant Ont as OntologyStore
  Client->>GW: POST /v1/ingest/records
  GW->>RT: persistIngestRecords
  RT->>GOV: validate entityType/properties
  RT->>Ont: upsertEntity scoped
  RT->>Ont: flushDurableWrites
  Ont-->>Client: job accepted
```

## Ingest source-run (collect-sensing → ontology)

Canonical ontology build is the gateway `DaemonRuntime` path. The Go `IngestionOrchestrator` (`POST /ingest/records` on `:8081`) is optional job metadata when `DAEMON_INGEST_SKIP_UPSTREAM` is unset.

```mermaid
sequenceDiagram
  participant Client
  participant GW as NestGateway
  participant Cat as SourceCatalog
  participant Conn as Connector
  participant Norm as RecordNormalizer
  participant RT as DaemonRuntime
  participant GO as GoOrchestrator
  Client->>GW: POST /v1/ingest/sources/:sourceId/run
  GW->>Cat: require sourceId
  GW->>Conn: fetch raw
  GW->>Norm: normalizeMany
  GW->>RT: upsertEntity per record
  RT->>RT: flushDurableWrites
  opt upstream job ledger
    GW->>GO: POST /ingest/records metadata
  end
  GW-->>Client: job accepted
```

## Natural-language ontology query (Neo4j)

When `DAEMON_NEO4J_URI` and `DAEMON_ONTOLOGY_QUERY_ENABLED=1` are set, the gateway exposes `POST /v1/query/ask`. Writes still flow through propagation into Neo4j (`neo4j-graph-sync`).

```mermaid
sequenceDiagram
  participant Client
  participant GW as NestGateway
  participant TC as TenantContext
  participant OQ as OntologyQueryChain
  participant N4j as Neo4j
  Client->>GW: POST /v1/query/ask
  GW->>TC: resolve tenant/domain
  GW->>OQ: ask(question)
  OQ->>OQ: generate Cypher (OpenRouter)
  OQ->>OQ: validate read-only + tenant params
  OQ->>N4j: runReadQuery
  OQ->>OQ: summarize answer (OpenRouter)
  OQ-->>Client: answer, optional cypher preview
```

## Natural-language ontology query (Neo4j)

When `DAEMON_NEO4J_URI` and `DAEMON_ONTOLOGY_QUERY_ENABLED=1` are set, the gateway exposes `POST /v1/query/ask`. Writes still flow through propagation into Neo4j (`neo4j-graph-sync`).

```mermaid
sequenceDiagram
  participant Client
  participant GW as NestGateway
  participant TC as TenantContext
  participant OQ as OntologyQueryChain
  participant N4j as Neo4j
  Client->>GW: POST /v1/query/ask
  GW->>TC: resolve tenant/domain
  GW->>OQ: ask(question)
  OQ->>OQ: generate Cypher (OpenRouter)
  OQ->>OQ: validate read-only + tenant params
  OQ->>N4j: runReadQuery
  OQ->>OQ: summarize answer (OpenRouter)
  OQ-->>Client: answer, optional cypher preview
```
