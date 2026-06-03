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
- **Vector layer** (`ontology/vector-layer/`): embedding and similarity lookups, optionally backed by the Rust vector shim.
- **Logic layer** (`ontology/logic-layer/`): rule evaluation and inference over registered entities.
- **Projections** (`ontology/projections/`): read-model builders fed from registry events.

## Cross-language registry

A Go HTTP registry mirrors the TypeScript registry semantics for use by the collect-sensing ingest path. Both share the same namespace/version contract so ingested records resolve to identical entity identities.
