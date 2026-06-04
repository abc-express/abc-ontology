# Overview

## Purpose

daemon-sdk implements a semantic control plane: ingest external data, model it in an ontology, serve reads and governed writes to humans and agents, and execute workflows with security and audit across the stack.

## Confirmed scope

| Item | Choice |
|------|--------|
| Layout | Monorepo at repository root |
| npm | `@daemon/platform-types`, `@daemon/sdk`, `@daemon/cli` |
| API | NestJS (`api/gateway`) |
| Tests | testcontainers / docker-compose — no mocks in integration or e2e |

## Bounded contexts

1. **collect-sensing** — ingest, normalize, enrich only; no business decisions.
2. **ontology** — entities, relations, events, semantic index, vectors, projections; scoped by tenant and domain.
3. **read-write-loops** — all human/agent reads and writes, approvals, external writes.
4. **action-runtime** — workflows, agents, commands; does not own ontology definitions.
5. **security-governance** — cross-cutting auth, policy, audit, guardrails.
6. **context-ports** (`@daemon/context-ports`) — `OntologyStore` and `AuditPort` interfaces used by the gateway composition root.

The NestJS gateway exposes ingest, read, and write through `DaemonRuntime` rather than calling registry or command types directly. See [02-bounded-contexts.md](./02-bounded-contexts.md) and [08-semantic-governance-alignment.md](./08-semantic-governance-alignment.md) (Ontology Master / Technology OS → module mapping tables).

## Milestones

- **M1** Foundation: configs, language validators, engines, data-platform clients, platform-types.
- **M2** Ingest + ontology (Go/Rust/TS).
- **M3** Read/write loops + security.
- **M4** Action runtime + NestJS + SDK/CLI.
- **M5** Observability, deployment, toolchain, full test suite.
- **Durability** (gateway): versioned Postgres migrations, entity snapshot journal + replay on startup, extended audit columns (`tenant_id`, `domain_id`, `metadata`). See [06-testing.md](./06-testing.md) and [06-deployment-topology.md](./06-deployment-topology.md).
- **Commercial ontology SSOT** (gateway): foundation pack relations/junctions, executable propagation (`read-model-projection`, `audit-loop`), governance policy gates for breaking schema changes, Postgres change log + RLS + graph edge persistence for `Link`. See [08-semantic-governance-alignment.md](./08-semantic-governance-alignment.md).
- **Logistics-commercial extension** (planned): public requirements stub in [PRD-logistics-commercial-extension.md](./PRD-logistics-commercial-extension.md); implementation follows approved extension pack, not foundation.

See [01-end-to-end-architecture.md](./01-end-to-end-architecture.md) for the system diagram.
