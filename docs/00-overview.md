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
2. **ontology** — entities, relations, events, semantic index, vectors, projections.
3. **read-write-loops** — all human/agent reads and writes, approvals, external writes.
4. **action-runtime** — workflows, agents, commands; does not own ontology definitions.
5. **security-governance** — cross-cutting auth, policy, audit, guardrails.

## Milestones

- **M1** Foundation: configs, language validators, engines, data-platform clients, platform-types.
- **M2** Ingest + ontology (Go/Rust/TS).
- **M3** Read/write loops + security.
- **M4** Action runtime + NestJS + SDK/CLI.
- **M5** Observability, deployment, toolchain, full test suite.

See [01-end-to-end-architecture.md](./01-end-to-end-architecture.md) for the system diagram.
