# Ontology system

The ontology is the system of record for entities, relations, events, states, and traits. It is composed of layered concerns coordinated by the registry.

```mermaid
graph TB
  REG[OntologyRegistry_TS]
  SEM[SemanticLayer]
  VEC[VectorLayer]
  LOG[LogicLayer]
  MOD[Models]
  PRJ[Projections]
  REG --> MOD
  REG --> SEM
  REG --> VEC
  REG --> LOG
  REG --> PRJ
```

## Layers

- **Registry** (`ontology/registry/`): namespacing, versioning, and entity lifecycle. Acts as the write path for all ontology mutations.
- **Models** (`ontology/models/`): typed definitions for entities, relations, events, states, and traits.
- **Semantic layer** (`ontology/semantic-layer/`): meaning resolution and term normalization.
- **Vector layer** (`ontology/vector-layer/`): embedding and similarity lookups, optionally backed by the Rust vector shim. On the gateway hot path, `ScopedOntologySearch` (`ontology/search/`) indexes entities on `register`/`patch` via propagation target `semantic-vector-index` and serves `GET /v1/search` (hybrid or keyword). On gateway startup with `DAEMON_POSTGRES_URL`, `replaySearchIndex` rebuilds the in-memory index from `daemon_entity_snapshots` (disable with `DAEMON_SEARCH_REPLAY=0`). Embeddings are pluggable via `DAEMON_EMBEDDING_PROVIDER` (`deterministic` default, or `openrouter` with `OPENROUTER_API_KEY` / `DAEMON_OPENROUTER_API_KEY`, `DAEMON_EMBEDDING_MODEL`, `DAEMON_EMBEDDING_DIMENSION`). Changing provider or model requires a gateway restart so replay re-embeds all documents with the active embedder.
- **Logic layer** (`ontology/logic-layer/`): rule evaluation and inference over registered entities.
- **Projections** (`ontology/projections/`): read-model builders fed from registry events. `EntityReadModelProjection` is attached in `DaemonRuntime` and updated by `PropagationExecutor` on register/patch (see `configs/governance/propagation.yaml`).
- **Pack SSOT** (`configs/ontology/packs/foundation/`): entities under `entities/`, relations under `relations/` (e.g. `Link`), junctions under `junctions/` (e.g. `CaseEvent`). Loaded by `loadFoundationPack()` and validated by `pnpm run check:ontology-pack`.
- **Governance** (`ontology/governance/`): `OntologyGovernance` validates entities, links, and junctions; `GovernancePolicyLoader` enforces breaking schema changes from `configs/policies/governance-policies.yaml` (CLI: `daemon-cli ontology validate-schema-change`).

## Cross-language registry

A Go HTTP registry mirrors the TypeScript registry semantics for use by the collect-sensing ingest path. Both share the same namespace/version contract so ingested records resolve to identical entity identities.
