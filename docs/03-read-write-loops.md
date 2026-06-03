# Read-write loops

Read-write loops coordinate the lifecycle of a request from read through policy, write, and optional external write.

```mermaid
sequenceDiagram
  participant Client
  participant Loop as LoopOrchestrator
  participant Read as ReadRouter
  participant Policy as PolicyEngine
  participant Write as CommandGateway
  participant Ext as ExternalWrites

  Client->>Loop: request
  Loop->>Read: resolve current state
  Loop->>Policy: evaluate decision
  alt allowed
    Loop->>Write: validate + mutate
    Write->>Loop: commit record
    opt external effect
      Loop->>Ext: dispatch external write
    end
  else denied
    Loop->>Client: POLICY_DENIED
  end
```

## Components

- **ReadRouter** (`read-write-loops/reads/`): resolves entities from the ontology registry with optional cache.
- **CommandGateway** (`read-write-loops/writes/command-gateway.ts`): entry point for mutations.
- **MutationValidator** (`read-write-loops/writes/mutation-validator.ts`): validates payloads against ontology models.
- **ConflictResolver**: applies `reject`, `last-write-wins`, or `merge` strategies under optimistic concurrency.
- **CommitManager**: append-only commit log with version lookup and rollback.
- **LoopOrchestrator** (`read-write-loops/loop-controller/`): drives read → policy → write → external-write, using the state machine, approval gates, and escalation engine.

## Concurrency

Writes use optimistic concurrency control. A version mismatch raises `ErrorCodes.CONFLICT`; the configured `ConflictResolver` strategy decides whether to reject, overwrite, or merge.
