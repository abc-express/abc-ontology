import { Body, Controller, Get, Param, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { AgentsService } from "./agents.service";
import { Protected } from "../auth/protected.decorator";
import { PolicyCheck } from "../auth/policy-check.decorator";
import { DaemonScope } from "../auth/daemon-scope.decorator";
import type { TenantContextHeaders } from "../platform/tenant-context";

@Controller("v1/agents")
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Post("sessions")
  @Protected()
  @PolicyCheck("read", "agent-session")
  createSession(
    @DaemonScope() ctx: TenantContextHeaders,
    @Body() body: { tools?: string[]; metadata?: Record<string, unknown> },
  ) {
    return this.agents.createSession(ctx, body ?? {});
  }

  @Get("sessions/:sessionId")
  @Protected()
  getSession(@Param("sessionId") sessionId: string) {
    return this.agents.getSession(sessionId) ?? { status: "not_found" };
  }

  @Post("sessions/:sessionId/run")
  @Protected()
  @PolicyCheck("chat", "agent-worker")
  runSession(
    @DaemonScope() ctx: TenantContextHeaders,
    @Param("sessionId") sessionId: string,
    @Body() body: { message: string },
  ) {
    return this.agents.runSession(ctx, sessionId, body);
  }

  @Post("sessions/:sessionId/stream")
  @Protected()
  @PolicyCheck("chat", "agent-worker")
  streamSession(
    @DaemonScope() ctx: TenantContextHeaders,
    @Param("sessionId") sessionId: string,
    @Body() body: { message: string },
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ) {
    const controller = new AbortController();
    req.on("close", () => controller.abort());
    return this.agents.streamSession(
      ctx,
      sessionId,
      body,
      res,
      controller.signal,
    );
  }

  @Post("sessions/:sessionId/tools")
  @Protected()
  invokeTool(
    @Param("sessionId") sessionId: string,
    @Body() body: { tool: string; input: Record<string, unknown> },
  ) {
    return this.agents.invokeTool(sessionId, body);
  }
}
