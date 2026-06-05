import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Response } from "express";
import type { OntologyScope } from "@daemon/context-ports";
import { DaemonError, ErrorCodes, entityId, ontologyId } from "@daemon/platform-types";
import {
  OntologyQueryChain,
  isOntologyQueryEnabled,
} from "@daemon/ontology-query";
import { buildPackGraphSchema } from "@daemon/ontology/graph-schema/pack-graph-schema.js";
import { ProductRuntime } from "@daemon/products/shared/product-runtime.js";
import {
  runSupervisor,
  runSupervisorStream,
} from "@daemon/products/agent-orchestrator/supervisor.js";
import { DaemonRuntime } from "../platform/daemon-runtime";
import type { TenantContextHeaders } from "../platform/tenant-context";
import { pumpSseStream } from "../streaming/sse.js";

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

  private productRuntime(ctx: TenantContextHeaders): ProductRuntime {
    return ProductRuntime.fromGatewayBridge({
      reads: this.runtime.reads,
      writes: this.runtime.writes,
      store: this.runtime.store,
      policy: this.runtime.policy,
      search: this.runtime.search,
      scope: { tenantId: ctx.tenantId, domainId: ctx.domainId },
    });
  }

  createSession(
    ctx: TenantContextHeaders,
    body: { tools?: string[]; metadata?: Record<string, unknown> },
  ): AgentSession {
    this.runtime.assertAllowed("read", "agent-session");
    const session: AgentSession = {
      sessionId: `as-${randomUUID()}`,
      tenantId: ctx.tenantId,
      domainId: ctx.domainId,
      tools: body.tools ?? ["read_entity", "search", "ontology_ask"],
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

  private requireSession(
    ctx: TenantContextHeaders,
    sessionId: string,
  ): AgentSession {
    const session = sessions.get(sessionId);
    if (!session || session.status !== "active") {
      throw new NotFoundException({ status: "not_found", sessionId });
    }
    if (
      session.tenantId !== ctx.tenantId ||
      session.domainId !== ctx.domainId
    ) {
      throw new DaemonError(
        ErrorCodes.POLICY_DENIED,
        "session tenant scope mismatch",
        403,
      );
    }
    return session;
  }

  private ontologyChain(): OntologyQueryChain | null {
    if (!isOntologyQueryEnabled()) return null;
    const store = this.runtime.neo4jStore;
    if (!store) return null;
    return OntologyQueryChain.fromEnv(store, {
      resolveSchemaSummary: (s: OntologyScope) => {
        const tenant = this.runtime.tenants.require(s.tenantId);
        const pack = this.runtime.packs.resolve(tenant, s.domainId);
        return buildPackGraphSchema(pack).promptSchemaSummary;
      },
    });
  }

  private async ontologyAsk(
    ctx: TenantContextHeaders,
    question: string,
  ): Promise<{ answer: string; error?: string }> {
    const chain = this.ontologyChain();
    if (!chain) {
      return {
        answer: "Ontology NL query is not configured.",
        error: "disabled",
      };
    }
    const scope: OntologyScope = {
      tenantId: ctx.tenantId,
      domainId: ctx.domainId,
    };
    const result = await chain.ask({ question, scope });
    return { answer: result.answer, error: result.error };
  }

  async runSession(
    ctx: TenantContextHeaders,
    sessionId: string,
    body: { message: string },
  ) {
    this.requireSession(ctx, sessionId);
    const runtime = this.productRuntime(ctx);
    return runSupervisor(
      {
        runtime,
        ontologyAsk: async (question) => {
          const result = await this.ontologyAsk(ctx, question);
          return result.answer;
        },
        askOntology: (question) => this.ontologyAsk(ctx, question),
      },
      {
        message: body.message,
        scope: { tenantId: ctx.tenantId, domainId: ctx.domainId },
      },
    );
  }

  async streamSession(
    ctx: TenantContextHeaders,
    sessionId: string,
    body: { message: string },
    res: Response,
    signal?: AbortSignal,
  ): Promise<void> {
    this.requireSession(ctx, sessionId);
    const runtime = this.productRuntime(ctx);
    await pumpSseStream(
      res,
      runSupervisorStream(
        {
          runtime,
          ontologyAsk: async (question) => {
            const result = await this.ontologyAsk(ctx, question);
            return result.answer;
          },
          askOntology: (question) => this.ontologyAsk(ctx, question),
        },
        {
          message: body.message,
          scope: { tenantId: ctx.tenantId, domainId: ctx.domainId },
        },
      ),
      { signal },
    );
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
