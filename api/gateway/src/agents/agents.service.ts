import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { TenantContextHeaders } from "../platform/tenant-context";
import { entityId, ontologyId } from "@daemon/platform-types";
import { DaemonRuntime } from "../platform/daemon-runtime";

export interface AgentSession {
  sessionId: string;
  tenantId: string;
  domainId: string;
  tools: string[];
  createdAt: string;
  status: "active" | "closed";
}

const sessions = new Map<string, AgentSession>();

@Injectable()
export class AgentsService {
  constructor(private readonly runtime: DaemonRuntime) {}

  createSession(
    ctx: TenantContextHeaders,
    body: { tools?: string[]; metadata?: Record<string, unknown> },
  ): AgentSession {
    this.runtime.assertAllowed("read", "agent-session");
    const session: AgentSession = {
      sessionId: `as-${randomUUID()}`,
      tenantId: ctx.tenantId,
      domainId: ctx.domainId,
      tools: body.tools ?? ["read_entity", "search"],
      createdAt: new Date().toISOString(),
      status: "active",
    };
    sessions.set(session.sessionId, session);
    void body.metadata;
    return session;
  }

  getSession(sessionId: string): AgentSession | undefined {
    return sessions.get(sessionId);
  }

  async invokeTool(
    sessionId: string,
    body: { tool: string; input: Record<string, unknown> },
  ): Promise<Record<string, unknown>> {
    const session = sessions.get(sessionId);
    if (!session) return { error: "session_not_found" };
    if (!session.tools.includes(body.tool)) {
      return { error: "tool_not_allowed", tool: body.tool };
    }
    if (body.tool === "read_entity") {
      const eid = String(body.input.entityId ?? "");
      const ont = String(body.input.ontologyId ?? "foundation");
      const scope = { tenantId: session.tenantId, domainId: session.domainId };
      const entity = this.runtime.store.get(
        scope,
        ontologyId(ont),
        entityId(eid),
      );
      return { entity };
    }
    return { ok: true, tool: body.tool };
  }
}
