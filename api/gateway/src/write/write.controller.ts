import { Body, Controller, Post } from "@nestjs/common";
import { WriteService } from "./write.service";
import type { DaemonSession } from "@daemon/platform-types";
import { Protected } from "../auth/protected.decorator";
import { PolicyCheck } from "../auth/policy-check.decorator";
import { Session } from "../auth/session.decorator";

/**
 * Write surface. The route is {@link Protected}: the global `AuthGuard`
 * requires a resolved {@link DaemonSession} (api key, bearer, or session
 * header) and `PolicyGuard` enforces a `write:entity` allow decision.
 */
@Controller("v1")
export class WriteController {
  constructor(private readonly writes: WriteService) {}

  @Post("write")
  @Protected()
  @PolicyCheck("write", "entity")
  write(
    @Session() session: DaemonSession,
    @Body()
    body: {
      entityId: string;
      ontologyId: string;
      patch: Record<string, unknown>;
      idempotencyKey?: string;
    },
  ) {
    return this.writes.submit(session, body);
  }
}
