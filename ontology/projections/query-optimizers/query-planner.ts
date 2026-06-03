import type { EntityReadModelProjection } from "../read-models/entity-read-model.js";

export interface EntityQuery {
  ontologyId: string;
  /** Optional exact-match filters on entity properties. */
  equals?: Record<string, unknown>;
  /** Optional direct entity id lookup; when present it short-circuits scans. */
  entityId?: string;
  limit?: number;
}

export type QueryStrategy = "point-lookup" | "indexed-scan" | "full-scan";

export interface QueryPlan {
  strategy: QueryStrategy;
  /** Estimated number of candidate rows the strategy inspects. */
  estimatedCandidates: number;
  reason: string;
}

export interface QueryResult<T> {
  plan: QueryPlan;
  rows: T[];
}

/**
 * Plans and executes entity queries against the read-model projection. The
 * planner chooses among three strategies and reports the chosen plan so callers
 * can observe and assert on optimizer decisions:
 *
 * - `point-lookup` when an entity id is supplied (O(1) map get).
 * - `indexed-scan` when equality filters exist (scan the ontology partition).
 * - `full-scan` when only an ontology is given (return the whole partition).
 */
export class QueryPlanner {
  constructor(private readonly projection: EntityReadModelProjection) {}

  plan(query: EntityQuery): QueryPlan {
    if (query.entityId !== undefined) {
      return {
        strategy: "point-lookup",
        estimatedCandidates: 1,
        reason: "entityId provided; direct key access",
      };
    }
    const partition = this.projection.list(query.ontologyId);
    if (query.equals && Object.keys(query.equals).length > 0) {
      return {
        strategy: "indexed-scan",
        estimatedCandidates: partition.length,
        reason: "equality filters; scan ontology partition",
      };
    }
    return {
      strategy: "full-scan",
      estimatedCandidates: partition.length,
      reason: "no filters; return full ontology partition",
    };
  }

  execute(
    query: EntityQuery,
  ): QueryResult<ReturnType<EntityReadModelProjection["list"]>[number]> {
    const plan = this.plan(query);

    if (plan.strategy === "point-lookup" && query.entityId !== undefined) {
      const found = this.projection.get(query.ontologyId, query.entityId);
      return { plan, rows: found ? [found] : [] };
    }

    let rows = this.projection.list(query.ontologyId);
    if (query.equals) {
      const filters = Object.entries(query.equals);
      rows = rows.filter((row) =>
        filters.every(([key, value]) => row.properties[key] === value),
      );
    }
    if (query.limit !== undefined && query.limit >= 0) {
      rows = rows.slice(0, query.limit);
    }
    return { plan, rows };
  }
}
