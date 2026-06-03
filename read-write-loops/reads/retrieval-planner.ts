import type { EntityId, OntologyId } from "@daemon/platform-types";

export interface RetrievalRequest {
  ontologyId: OntologyId;
  entityId: EntityId;
  fields?: string[];
  consistency?: "strong" | "cached";
}

export type RetrievalStepKind = "cache-lookup" | "registry-read" | "projection";

export interface RetrievalStep {
  kind: RetrievalStepKind;
  description: string;
}

export interface RetrievalPlan {
  steps: RetrievalStep[];
  usesCache: boolean;
  projectedFields: string[] | null;
}

/**
 * Builds an ordered retrieval plan for a read request. The plan is consumed by
 * the read router/response assembler; branching reflects consistency mode and
 * whether a field projection was requested.
 */
export class RetrievalPlanner {
  plan(req: RetrievalRequest): RetrievalPlan {
    const steps: RetrievalStep[] = [];
    const usesCache = req.consistency !== "strong";

    if (usesCache) {
      steps.push({
        kind: "cache-lookup",
        description: `check cache for ${req.ontologyId}/${req.entityId}`,
      });
    }

    steps.push({
      kind: "registry-read",
      description: `resolve ${req.ontologyId}/${req.entityId} from registry`,
    });

    const projectedFields =
      req.fields && req.fields.length > 0 ? [...req.fields] : null;
    if (projectedFields) {
      steps.push({
        kind: "projection",
        description: `project fields: ${projectedFields.join(", ")}`,
      });
    }

    return { steps, usesCache, projectedFields };
  }
}
