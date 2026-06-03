import type { EntityId, OntologyId } from "@daemon/platform-types";
import { DaemonError, ErrorCodes } from "@daemon/platform-types";
import { globalRegistry, type EntityRecord } from "@daemon/ontology";

export interface ReadRequest {
  ontologyId: OntologyId;
  entityId: EntityId;
}

export class ReadRouter {
  route(req: ReadRequest): EntityRecord {
    const record = globalRegistry.get(req.ontologyId, req.entityId);
    if (!record) {
      throw new DaemonError(
        ErrorCodes.NOT_FOUND,
        `not found: ${req.ontologyId}/${req.entityId}`,
        404,
      );
    }
    return record;
  }
}
