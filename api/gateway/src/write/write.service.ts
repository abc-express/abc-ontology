import { Injectable } from "@nestjs/common";
import { CommandGateway } from "@daemon/read-write-loops/writes/command-gateway.js";
import type { DaemonSession } from "@daemon/platform-types";
import { entityId, ontologyId } from "@daemon/platform-types";

@Injectable()
export class WriteService {
  private readonly gateway = new CommandGateway();

  submit(
    session: DaemonSession,
    body: {
      entityId: string;
      ontologyId: string;
      patch: Record<string, unknown>;
      idempotencyKey?: string;
    },
  ) {
    return this.gateway.submit({
      session,
      ontologyId: ontologyId(body.ontologyId),
      entityId: entityId(body.entityId),
      patch: body.patch,
      idempotencyKey: body.idempotencyKey,
    });
  }
}
