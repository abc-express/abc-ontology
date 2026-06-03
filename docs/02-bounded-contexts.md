# Bounded contexts

| Context | Responsibility | Must not |
|---------|----------------|----------|
| collect-sensing | Ingest, normalize, enrich | Decide business outcomes |
| ontology | Semantic truth, versions | Execute workflows |
| read-write-loops | Reads, writes, approvals | Define ontology schema alone |
| action-runtime | Workflows, agents | Own registry |
| security-governance | Auth, policy, audit | Store business entities |

Cross-cutting: `engine/`, `data-platform/`, `observability/`.
