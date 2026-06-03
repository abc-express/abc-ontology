import type { DaemonSession, EntityId, OntologyId } from "@daemon/platform-types";
import { DaemonError, ErrorCodes } from "@daemon/platform-types";
import { globalRegistry, type EntityRecord } from "@daemon/ontology";
import type { ProductRuntime } from "../shared/product-runtime.js";

/**
 * Admin console operations over the ontology registry (list, register, read).
 */
export class AdminOperations {
  constructor(private readonly runtime: ProductRuntime) {}

  list(ontologyId: OntologyId): EntityRecord[] {
    this.runtime.assertAllowed("admin", "ontology");
    return globalRegistry.list(ontologyId);
  }

  read(ontologyId: OntologyId, id: EntityId): EntityRecord {
    this.runtime.assertAllowed("read", "entity");
    return this.runtime.reads.route({ ontologyId, entityId: id });
  }

  register(
    session: DaemonSession,
    ontologyId: OntologyId,
    properties: Record<string, unknown>,
    id?: EntityId,
  ): EntityRecord {
    this.runtime.assertAllowed("admin", "ontology");
    if (!session.subjectId) {
      throw new DaemonError(ErrorCodes.VALIDATION, "session subject required", 400);
    }
    const record = globalRegistry.register(ontologyId, properties, id);
    return record;
  }

  patchEntity(
    session: DaemonSession,
    ontologyId: OntologyId,
    id: EntityId,
    patch: Record<string, unknown>,
    idempotencyKey?: string,
  ): { writeId: string; version: number } {
    const resource = `${ontologyId}/${id}`;
    const decision = this.runtime.policy.evaluate("write", "entity");
    if (decision.effect === "deny") {
      throw new DaemonError(
        ErrorCodes.POLICY_DENIED,
        `denied write on ${resource}`,
        403,
      );
    }
    const result = this.runtime.writes.submit({
      session,
      ontologyId,
      entityId: id,
      patch,
      idempotencyKey,
    });
    return { writeId: result.writeId, version: result.version };
  }
}
