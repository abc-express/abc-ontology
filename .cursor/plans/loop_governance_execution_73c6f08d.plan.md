---
name: Loop governance execution
overview: Broaden semantic propagation beyond generic projection/audit targets, load gateway policy from action-catalog.yaml, add real pack YAML diffing with governance-policies obligations on validate-change, and wire post-commit action-runtime workflows from LoopOrchestrator outcomes (architecture spec step 6).
todos:
  - id: action-catalog-policy
    content: Add action-catalog-loader; wire DaemonRuntime PolicyEngine; extend check:governance-policies + tests
    status: completed
  - id: pack-diff-governance
    content: Implement pack-diff.ts; extend GovernancePolicyLoader obligations; expand validate-change API/CLI + tests
    status: completed
  - id: propagation-broaden
    content: Entity-scoped propagation.yaml rules; PropagationExecutor targets (MV, graph-edge-sync); DaemonRuntime wiring + integration tests
    status: completed
  - id: loop-workflow-hook
    content: action-catalog onCommitted; post-commit WorkflowOrchestrator in runWriteLoop; docs + optional automations loopFirst
    status: completed
isProject: false
---

# Loop, governance, and execution wiring

## Current gaps

| Area | Today | Target |
|------|--------|--------|
| Propagation | All entity types hit only `read-model-projection` + `audit-loop` ([`propagation.yaml`](configs/governance/propagation.yaml), [`propagation-executor.ts`](ontology/governance/propagation-executor.ts)) | Entity-scoped rules + materialized views + post-commit workflow hook |
| Gateway policy | Hardcoded [`DEFAULT_GATEWAY_POLICY_RULES`](api/gateway/src/platform/daemon-runtime.ts) | Single source: [`action-catalog.yaml`](configs/governance/action-catalog.yaml) |
| validate-change | Client sends [`SchemaChangeDescriptor`](ontology/governance/governance-policy-loader.ts) with manual `breaking` | Diff baseline pack YAML vs proposed; infer breaking + obligations from [`governance-policies.yaml`](configs/policies/governance-policies.yaml) |
| Loop → workflows | [`runWriteLoop`](api/gateway/src/platform/daemon-runtime.ts) audits only; [`TaskOrchestrator`](products/automations/task-orchestrator.ts) runs WF **before** loop | After `committed`, run catalog-driven workflow steps (spec: LOOP → APPROVAL → WF) |

```mermaid
sequenceDiagram
  participant Client
  participant Loop as LoopOrchestrator
  participant Prop as PropagationExecutor
  participant WF as WorkflowOrchestrator

  Client->>Loop: runWriteLoop
  Loop->>Loop: read policy write commit
  Note over Loop: registry event
  Prop->>Prop: projection audit MV graph workflow-hook
  Loop->>WF: onCommitted steps from action-catalog
  Loop-->>Client: LoopOutcome + workflowResults
```

---

## 1. Bind action-catalog to gateway policy

**Add** [`ontology/governance/action-catalog-loader.ts`](ontology/governance/action-catalog-loader.ts):

- Parse `configs/governance/action-catalog.yaml` (`actions[].id` → `action`, `resource`, `effect`).
- Export `loadActionCatalogPolicyRules(): PolicyRule[]` and optional metadata (`onCommitted` — see §4).

**Change** [`DaemonRuntime`](api/gateway/src/platform/daemon-runtime.ts):

- Replace `PolicyEngine.fromRules(DEFAULT_GATEWAY_POLICY_RULES)` with catalog loader (sync read at construct time is fine; mirror [`TenantRegistry.fromYamlFile`](ontology/tenancy/tenant-registry.ts)).
- Keep `DEFAULT_GATEWAY_POLICY_RULES` only as a **test fallback** when catalog file is missing.

**CI** — extend [`scripts/check-governance-policies.mjs`](scripts/check-governance-policies.mjs):

- Assert every gateway `@PolicyCheck` action/resource pair exists in the catalog (grep or small manifest list: `read/entity`, `write/entity`, `ingest/*`).
- Fail if catalog and hardcoded rules diverge (loader is sole runtime source).

**Tests:** unit test loader; gateway integration test that denying an unknown action is impossible when catalog allows ingest.

**Docs:** update [`docs/05-security-governance.md`](docs/05-security-governance.md) table row for action-catalog → “wired at gateway startup”.

---

## 2. Broaden PropagationExecutor targets

### 2a. Schema and config

Extend propagation rule shape in [`OntologyGovernance`](ontology/governance/ontology-governance.ts) / manifest typing:

```yaml
# configs/governance/propagation.yaml (illustrative)
rules:
  - id: case-register
    trigger: register
    entityTypes: [Case]
    propagate: [read-model-projection, materialized-view:case-by-status]
  - id: case-patch
    trigger: patch
    entityTypes: [Case]
    propagate: [read-model-projection, audit-loop, materialized-view:case-by-status]
  - id: party-patch
    trigger: patch
    entityTypes: [Party, Organization]
    propagate: [read-model-projection, materialized-view:party-by-kind]
  - id: link-register
    trigger: register
    entityTypes: [Link]
    propagate: [read-model-projection, graph-edge-sync]
  - id: default-register
    trigger: register
    propagate: [read-model-projection]
```

Rules without `entityTypes` apply to all types (backward compatible).

### 2b. Executor

Refactor [`PropagationExecutor`](ontology/governance/propagation-executor.ts):

- Accept a `PropagationTargets` registry: `EntityReadModelProjection`, `AuditPort`, `Map<string, MaterializedView>`, optional `GraphEdgeSyncPort` (thin adapter calling existing journal/graph upsert when `entityType === "Link"`).
- Filter rules by `ctx.record.entityType`.
- Implement handlers for new target IDs (unknown target → throw in dev / audit warning in prod).

Wire on [`DaemonRuntime`](api/gateway/src/platform/daemon-runtime.ts):

- Instantiate views: `case-by-status` → `groupBy(p => String(p.status ?? "unknown"))`, `party-by-kind` → `groupBy(p => String(p.partyKind ?? "unknown"))`.
- Attach materialized views to registry **in addition** to projection (views already subscribe via `attach()` in [`materialized-view.ts`](ontology/projections/materialized-views/materialized-view.ts)); propagation path calls `apply(event)` for consistency with rule-driven semantics.

**CI:** update allowed targets in [`check-governance-policies.mjs`](scripts/check-governance-policies.mjs) to validate target names against a canonical list.

**Tests:**

- Extend [`tests/integration/ontology-propagation.integration.test.ts`](tests/integration/ontology-propagation.integration.test.ts): register/patch `Case` updates `case-by-status` bucket counts.
- Unit test rule filtering (Party vs Case).

**Docs:** [`docs/08-semantic-governance-alignment.md`](docs/08-semantic-governance-alignment.md) — list entity-scoped propagation targets.

---

## 3. Pack YAML diff + governance obligations

### 3a. Pack diff engine

**Add** [`ontology/packs/pack-diff.ts`](ontology/packs/pack-diff.ts):

- Compare two packs (baseline from `loadFoundationPack()` / `loadExtensionPack(packId)` vs proposed):
  - Per-entity field add/remove/type/required changes → `SchemaChangeType[]`
  - Relation/junction add/remove
- Derive `breaking: boolean` (e.g. `field_remove`, `type_rename`, relation_remove → breaking; optional field add → non-breaking).
- Suggest `semverBump` (major if breaking, else minor/patch).

### 3b. Governance policy loader

Extend [`GovernancePolicyLoader`](ontology/governance/governance-policy-loader.ts):

- Load full manifest: `escalation`, `audit`, `retention`, `approvalGates`.
- `resolveObligations(context)`:
  - `schema-change` → `collect-approvals` with count from gate
  - Include change-specific tags (e.g. `semver-major`, `relation-change`) when diff reports them
- `externalSystemApprovers()` from `approvalGates` entry `external-system` (for loop external writes later)

Extend [`assertSchemaChange`](ontology/governance/governance-policy-loader.ts) to accept optional precomputed diff summary; when `breaking` omitted, infer from diff.

### 3c. validate-change API

**Request body** (union, backward compatible):

```typescript
// New primary shape
interface ValidatePackChangeRequest {
  packId: string;
  proposedPackDir?: string;  // path under configs/ontology/packs/...
  proposedOverrides?: { entities?: Record<string, { fields: ... }> }; // optional inline
  approvals?: string[];
}
// Legacy: SchemaChangeDescriptor still accepted
```

**Response:**

```typescript
{
  allowed, reason, obligations, auditAction,
  diff: { changes: [...], breaking, semverBump }
}
```

**Files:** [`governance.controller.ts`](api/gateway/src/governance/governance.controller.ts), [`governance.service.ts`](api/gateway/src/governance/governance.service.ts), [`api/rest/src/server.ts`](api/rest/src/server.ts), [`packages/cli/src/validate-schema-change.ts`](packages/cli/src/validate-schema-change.ts) (optional `--proposed-dir`).

**Tests:** fixture with removed required field → `allowed: false`, `obligations` includes `collect-approvals`; additive optional field → allowed without approvals.

---

## 4. Connect LoopOrchestrator outcomes to action-runtime (spec step 6)

### 4a. Catalog extension

Extend [`action-catalog.yaml`](configs/governance/action-catalog.yaml) (optional per action):

```yaml
  - id: write
    resource: entity
    effect: allow
    onCommitted:
      - { workflow: entity-write-audit, action: workflow.execute }
```

Loader exposes `stepsFor(action, resource, context?: { entityType })`.

### 4b. Loop integration

**Option A (minimal, recommended):** post-commit hook in [`DaemonRuntime.runWriteLoop`](api/gateway/src/platform/daemon-runtime.ts):

1. Run existing `createLoop().run(...)`.
2. If `outcome.state === "committed"`, resolve entity type from store read, load `onCommitted` steps, `await WorkflowOrchestrator.run(steps)`.
3. Audit `workflow.execute` with loop trace metadata.
4. Return extended outcome: `LoopOutcome & { workflowResults?: string[] }` (gateway DTO).

**Option B (deeper):** add optional `WorkflowPort` to [`LoopOrchestrator`](read-write-loops/loop-controller/loop-orchestrator.ts) invoked at `committed` transition — keeps product runtime able to inject same port.

**Automations:** add optional `loopFirst?: boolean` on [`AutomationsRunBody`](api/gateway/src/automations/automations.service.ts); when true, run loop then workflows (spec order). Default `false` preserves current clients; document migration in OpenAPI.

**Gateway automations path:** consider injecting shared `DaemonRuntime` policy + workflow hook so automations and writes use one catalog (stretch: replace standalone [`ProductRuntime`](products/shared/product-runtime.ts) in gateway-only paths first).

**Tests:**

- Unit: mock `WorkflowPort` called only on successful commit.
- Integration: `POST /v1/write/...` with catalog `onCommitted` → response includes workflow result ids.

**Docs:** [`docs/07-sequence-flows.md`](docs/07-sequence-flows.md) or [`docs/01-end-to-end-architecture.md`](docs/01-end-to-end-architecture.md) — diagram LOOP → WF; reference spec step 6 in [`perplexity-architecture-spec.md`](docs/reference/perplexity-architecture-spec.md) without copying partner content.

---

## 5. Execution order and scope boundaries

| In scope | Out of scope (defer) |
|----------|---------------------|
| Foundation + extension pack diff for validate-change | Full `PackResolver.merge` for multi-pack proposed state |
| Named materialized views for Case/Party (+ Link graph target if journal adapter is small) | NATS/event backbone propagation |
| Post-commit stub workflows via existing [`WorkflowOrchestrator`](action-runtime/workflow-engine/workflow-orchestrator.ts) | Real external command dispatch |
| CI + unit/integration tests above | Replacing all `ProductRuntime` usages in products |

---

## Suggested implementation order

1. **action-catalog-loader** + gateway policy (unblocks consistent guards).
2. **pack-diff** + governance obligations + validate-change API/CLI.
3. **propagation** schema, executor, materialized views, CI target list.
4. **loop → workflow** hook + catalog `onCommitted` + tests/docs.
5. Optional: automations `loopFirst` + gateway-shared runtime.

## Validation commands

```bash
pnpm run check:governance-policies
pnpm run check:ontology-pack
pnpm run test:repo   # or targeted packages: ontology, read-write-loops, api/gateway
```
