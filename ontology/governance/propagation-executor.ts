import type { EntityRecord, OntologyScope } from "@daemon/context-ports";
import type { AuditPort } from "@daemon/context-ports";
import type { GovernanceManifest } from "./ontology-governance.js";
import type { EntityReadModelProjection } from "../projections/read-models/entity-read-model.js";
import type { MaterializedView } from "../projections/materialized-views/materialized-view.js";
import type { GraphEdgeSyncPort } from "./propagation-graph-sync.js";
import type { Neo4jGraphSync } from "../graph-sync/neo4j-graph-sync.js";

export type PropagationTrigger = "register" | "patch";

export type PropagationRule = GovernanceManifest["rules"][number];

export interface PropagationContext {
  trigger: PropagationTrigger;
  record: EntityRecord;
  scope: OntologyScope;
  subjectId?: string;
}

export interface PropagationTargets {
  projection: EntityReadModelProjection;
  audit: AuditPort;
  materializedViews: Map<string, MaterializedView>;
  graphEdgeSync?: GraphEdgeSyncPort;
  neo4jGraphSync?: Neo4jGraphSync;
}

const KNOWN_TARGETS = new Set([
  "read-model-projection",
  "audit-loop",
  "graph-edge-sync",
  "neo4j-graph-sync",
]);

function isMaterializedViewTarget(target: string): string | undefined {
  const prefix = "materialized-view:";
  if (!target.startsWith(prefix)) return undefined;
  return target.slice(prefix.length);
}

function ruleMatches(rule: PropagationRule, ctx: PropagationContext): boolean {
  if (rule.trigger !== ctx.trigger) return false;
  if (!rule.entityTypes?.length) return true;
  const entityType = ctx.record.entityType ?? "";
  return rule.entityTypes.includes(entityType);
}

/**
 * Executes propagation.yaml targets after entity register/patch.
 */
export class PropagationExecutor {
  constructor(
    private readonly rules: PropagationRule[],
    private readonly targets: PropagationTargets,
  ) {}

  run(ctx: PropagationContext): void {
    const matching = this.rules.filter((r) => ruleMatches(r, ctx));
    for (const rule of matching) {
      for (const target of rule.propagate) {
        this.applyTarget(target, rule.id, ctx);
      }
    }
  }

  private applyTarget(
    target: string,
    ruleId: string,
    ctx: PropagationContext,
  ): void {
    const mvName = isMaterializedViewTarget(target);
    if (mvName) {
      const view = this.targets.materializedViews.get(mvName);
      if (!view) {
        throw new Error(`unknown materialized view target: ${mvName}`);
      }
      view.apply({
        kind: ctx.trigger === "register" ? "registered" : "patched",
        record: ctx.record,
      });
      return;
    }

    if (!KNOWN_TARGETS.has(target) && !mvName) {
      throw new Error(`unknown propagation target: ${target}`);
    }

    if (target === "read-model-projection") {
      this.targets.projection.apply({
        kind: ctx.trigger === "register" ? "registered" : "patched",
        record: ctx.record,
      });
    }
    if (target === "audit-loop") {
      this.targets.audit.record({
        action: "propagation.applied",
        subjectId: ctx.subjectId ?? "system",
        resource: `${ctx.scope.tenantId}/${ctx.scope.domainId}/${ctx.record.ontologyId}/${ctx.record.entityId}`,
        outcome: "allow",
        tenantId: ctx.scope.tenantId,
        domainId: ctx.scope.domainId,
        metadata: {
          ruleId,
          trigger: ctx.trigger,
          target,
          entityType: ctx.record.entityType,
        },
      });
    }
    if (target === "graph-edge-sync") {
      this.targets.graphEdgeSync?.sync(ctx.record, ctx.scope);
    }
    if (target === "neo4j-graph-sync") {
      if (!this.targets.neo4jGraphSync) return;
      this.targets.neo4jGraphSync.sync(ctx.record, ctx.scope);
    }
  }
}
