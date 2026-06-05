import { Body, Controller, Headers, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { Protected } from "../auth/protected.decorator";
import { PolicyCheck } from "../auth/policy-check.decorator";
import { DaemonScope } from "../auth/daemon-scope.decorator";
import type { TenantContextHeaders } from "../platform/tenant-context";
import { ProductsService } from "./products.service";

@Controller("v1/products")
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Post("customer-gpt/chat")
  @Protected()
  @PolicyCheck("chat", "customer-gpt")
  chat(
    @DaemonScope() ctx: TenantContextHeaders,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body()
    body: {
      turns: { role: "user" | "assistant"; content: string }[];
      ontologyId?: string;
      limit?: number;
    },
  ) {
    const sessionHeader = headers["x-session-id"];
    const sessionId = Array.isArray(sessionHeader)
      ? sessionHeader[0]
      : sessionHeader;
    return this.products.customerGptChat(ctx, body, sessionId);
  }

  @Post("customer-gpt/chat/stream")
  @Protected()
  @PolicyCheck("chat", "customer-gpt")
  chatStream(
    @DaemonScope() ctx: TenantContextHeaders,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body()
    body: {
      turns: { role: "user" | "assistant"; content: string }[];
      ontologyId?: string;
      limit?: number;
    },
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ) {
    const sessionHeader = headers["x-session-id"];
    const sessionId = Array.isArray(sessionHeader)
      ? sessionHeader[0]
      : sessionHeader;
    const controller = new AbortController();
    req.on("close", () => controller.abort());
    return this.products.customerGptChatStream(
      ctx,
      body,
      sessionId,
      res,
      controller.signal,
    );
  }

  @Post("shadow-pricing/simulate")
  @Protected()
  @PolicyCheck("query", "analytics")
  shadowPricingSimulate(
    @DaemonScope() ctx: TenantContextHeaders,
    @Body()
    body: {
      ontologyId?: string;
      shipmentRef?: string;
      limit?: number;
    },
  ) {
    return this.products.shadowPricingSimulate(ctx, body);
  }
}
