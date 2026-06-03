import type { DaemonSession, EntityId, OntologyId } from "@daemon/platform-types";
import { globalRegistry } from "@daemon/ontology";
import { MutationValidator } from "./mutation-validator.js";

export interface WriteCommand {
  session: DaemonSession;
  ontologyId: OntologyId;
  entityId: EntityId;
  patch: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface WriteResult {
  writeId: string;
  status: "committed";
  version: number;
}

export class CommandGateway {
  private readonly validator = new MutationValidator();
  private readonly idempotency = new Map<string, WriteResult>();

  submit(cmd: WriteCommand): WriteResult {
    if (cmd.idempotencyKey) {
      const cached = this.idempotency.get(cmd.idempotencyKey);
      if (cached) return cached;
    }
    this.validator.validate(cmd);
    const updated = globalRegistry.patch(
      cmd.ontologyId,
      cmd.entityId,
      cmd.patch,
    );
    const result: WriteResult = {
      writeId: `w-${Date.now()}`,
      status: "committed",
      version: updated.version,
    };
    if (cmd.idempotencyKey) {
      this.idempotency.set(cmd.idempotencyKey, result);
    }
    return result;
  }
}
