import type { OntologyId, EntityId } from "@daemon/platform-types";

export interface ReadContextInput {
  ontologyId: OntologyId;
  entityId: EntityId;
  principal?: string;
  consistency?: "strong" | "cached";
  requestedFields?: string[];
}

export interface ReadContext {
  key: string;
  ontologyId: OntologyId;
  entityId: EntityId;
  principal: string;
  consistency: "strong" | "cached";
  requestedFields: string[] | null;
  startedAt: string;
}

/**
 * Builds the immutable context object that travels with a read request through
 * the loop. Normalizes optional inputs into deterministic defaults so that
 * downstream planners and assemblers can rely on a fully-populated shape.
 */
export class ContextBuilder {
  build(input: ReadContextInput): ReadContext {
    const fields =
      input.requestedFields && input.requestedFields.length > 0
        ? [...new Set(input.requestedFields)].sort()
        : null;

    return {
      key: `${input.ontologyId}:${input.entityId}`,
      ontologyId: input.ontologyId,
      entityId: input.entityId,
      principal: input.principal ?? "anonymous",
      consistency: input.consistency ?? "strong",
      requestedFields: fields,
      startedAt: new Date().toISOString(),
    };
  }
}
