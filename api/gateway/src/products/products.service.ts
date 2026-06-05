import { Injectable } from "@nestjs/common";
import type { Response } from "express";
import { ontologyId } from "@daemon/platform-types";
import { GptSessionStore } from "@daemon/data-platform/product-sessions/gpt-session-store";
import { ProductRuntime } from "@daemon/products/shared/product-runtime.js";
import { GptOrchestrator } from "@daemon/products/customer-gpt/gpt-orchestrator.js";
import { ShadowPricing } from "@daemon/products/analytics-workflows/shadow-pricing.js";
import { DaemonRuntime } from "../platform/daemon-runtime";
import type { TenantContextHeaders } from "../platform/tenant-context";
import { pumpSseStream } from "../streaming/sse.js";

@Injectable()
export class ProductsService {
  private readonly gptSessions = GptSessionStore.fromEnv();

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

  async customerGptChat(
    ctx: TenantContextHeaders,
    body: {
      turns: { role: "user" | "assistant"; content: string }[];
      ontologyId?: string;
      limit?: number;
    },
    sessionId?: string,
  ) {
    const scope = { tenantId: ctx.tenantId, domainId: ctx.domainId };
    const priorCitations =
      sessionId && this.gptSessions
        ? await this.gptSessions.getCitations(scope, sessionId)
        : [];

    const product = this.productRuntime(ctx);
    const orchestrator = new GptOrchestrator(product);
    const ont = body.ontologyId ? ontologyId(body.ontologyId) : undefined;
    const result = await orchestrator.converse({
      turns: body.turns,
      ontologyId: ont,
      limit: body.limit,
    });
    if (sessionId && result.guardEffect === "allow" && this.gptSessions) {
      await this.gptSessions.upsertCitations(
        scope,
        sessionId,
        result.citations,
      );
    }
    return {
      ...result,
      sessionId: sessionId ?? null,
      priorCitations,
    };
  }

  async customerGptChatStream(
    ctx: TenantContextHeaders,
    body: {
      turns: { role: "user" | "assistant"; content: string }[];
      ontologyId?: string;
      limit?: number;
    },
    sessionId: string | undefined,
    res: Response,
    signal?: AbortSignal,
  ): Promise<void> {
    const scope = { tenantId: ctx.tenantId, domainId: ctx.domainId };
    const priorCitations =
      sessionId && this.gptSessions
        ? await this.gptSessions.getCitations(scope, sessionId)
        : [];

    const product = this.productRuntime(ctx);
    const orchestrator = new GptOrchestrator(product);
    const ont = body.ontologyId ? ontologyId(body.ontologyId) : undefined;

    const gptSessions = this.gptSessions;
    async function* streamChunks() {
      for await (const chunk of orchestrator.converseStream({
        turns: body.turns,
        ontologyId: ont,
        limit: body.limit,
      })) {
        if (
          chunk.event === "done" &&
          sessionId &&
          gptSessions &&
          chunk.data &&
          typeof chunk.data === "object" &&
          "guardEffect" in chunk.data &&
          (chunk.data as { guardEffect: string }).guardEffect === "allow" &&
          "citations" in chunk.data
        ) {
          await gptSessions.upsertCitations(
            scope,
            sessionId,
            (chunk.data as { citations: string[] }).citations,
          );
        }
        yield chunk;
      }
      if (sessionId) {
        yield {
          event: "node" as const,
          data: {
            type: "node",
            name: "session",
            status: "end",
            data: { sessionId, priorCitations },
          },
        };
      }
    }

    await pumpSseStream(res, streamChunks(), { signal });
  }

  async shadowPricingSimulate(
    ctx: TenantContextHeaders,
    body: {
      ontologyId?: string;
      shipmentRef?: string;
      limit?: number;
    },
  ) {
    const product = this.productRuntime(ctx);
    const pricing = new ShadowPricing(product);
    const ont = body.ontologyId ? ontologyId(body.ontologyId) : undefined;
    return pricing.simulate({
      ontologyId: ont,
      shipmentRef: body.shipmentRef,
      limit: body.limit,
    });
  }
}
