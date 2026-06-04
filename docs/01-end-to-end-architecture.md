# End-to-end architecture

```mermaid
graph TB
  subgraph collect [CollectSensing_TS]
    CAT[SourceCatalog]
    NORM[RecordNormalizer]
  end
  subgraph ingest_go [CollectSensing_Go]
    ING[IngestionOrchestrator_job_ledger]
  end
  subgraph ont [Ontology]
    REG[ScopedRegistry_TS]
    PACK[PackResolver]
    GOV[GovernanceValidator]
  end
  subgraph loops [ReadWriteLoops_TS]
    READ[ReadRouter]
    LOOP[LoopOrchestrator]
  end
  subgraph action_runtime [ActionRuntime_TS]
    WF[WorkflowOrchestrator]
  end
  subgraph products_layer [Products_TS]
    ANAL[AnalyticsWorkflows]
    AUTO[AutomationsWorkflows]
  end
  subgraph sec [SecurityGovernance]
    AUD[AuditPort]
    POL[PolicyEngine]
  end
  subgraph cross_cutting [CrossCutting]
    ENG[engine]
    DP[data_platform]
    OBS[observability]
    PORTS[context_ports]
  end
  subgraph api [NestJS_Gateway]
    RT[DaemonRuntime]
    GW[Controllers]
  end
  GW --> CAT
  CAT --> NORM
  NORM --> RT
  GW -.-> ING
  GW --> RT
  RT --> READ
  RT --> LOOP
  RT --> REG
  RT --> PACK
  RT --> GOV
  RT --> AUD
  LOOP --> REG
  LOOP --> POL
  READ --> REG
  GW --> ANAL
  GW --> AUTO
  AUTO --> WF
  WF --> LOOP
  PORTS -.-> REG
  PORTS -.-> AUD
  DP -.-> AUD
  OBS -.-> GW
  ENG -.-> GOV
```

**Canonical HTTP** is the NestJS gateway (`api/gateway`) composed through `DaemonRuntime`: ingest, read, write, analytics, and automations controllers resolve tenant/domain headers, validate packs, and route writes through `LoopOrchestrator` with policy and audit.

The standalone REST app ([api/rest](../api/rest)) mirrors read/write/analytics/automations semantics and publishes [OpenAPI](../api/rest/src/openapi.ts) for contract tests; it does not expose the full ingest surface. Use the gateway for production ingest and full tenant/domain enforcement.

**Bounded contexts** (six) plus cross-cutting infra are listed in [02-bounded-contexts.md](./02-bounded-contexts.md). Data flows: external sources → collect-sensing connectors and normalization in TypeScript → gateway `DaemonRuntime` upsert into ontology (scoped by tenant/domain) → read/write loops and products → action-runtime workflows where automations commit governed writes. The Go ingestion orchestrator records optional job metadata only; it does not register entities in the ontology store.

Governance and pack metadata live under `configs/ontology/` and `configs/governance/`; mapping to Ontology Master / Technology OS tiers is in [08-semantic-governance-alignment.md](./08-semantic-governance-alignment.md).

## Related docs (platform and Data Ops maps)

- [16-data-ops-lifecycle-map.md](./16-data-ops-lifecycle-map.md) — Connect → Transform → Model → Analyze
- [17-platform-decision-map.md](./17-platform-decision-map.md) — Data / Logic / Actions pillars
- [18-enterprise-platform-map.md](./18-enterprise-platform-map.md) — Foundry-style layers and [`products/`](../products/) application map
