import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { DaemonSession } from "@daemon/platform-types";

/**
 * Injects the resolved {@link DaemonSession} attached to the request by
 * {@link AuthGuard}. Returns `undefined` on open routes with no credentials.
 */
export const Session = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): DaemonSession | undefined => {
    const request = ctx.switchToHttp().getRequest<{ daemonSession?: DaemonSession }>();
    return request.daemonSession;
  },
);
