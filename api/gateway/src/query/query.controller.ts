import { Body, Controller, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { Protected } from "../auth/protected.decorator";
import { PolicyCheck } from "../auth/policy-check.decorator";
import { DaemonScope } from "../auth/daemon-scope.decorator";
import type { TenantContextHeaders } from "../platform/tenant-context";
import { QueryService } from "./query.service";
import { AskOntologyQueryDto } from "./query.dto";

@Controller("v1/query")
export class QueryController {
  constructor(private readonly query: QueryService) {}

  @Post("ask")
  @Protected()
  @PolicyCheck("query", "ontology-nl")
  ask(@DaemonScope() ctx: TenantContextHeaders, @Body() body: AskOntologyQueryDto) {
    return this.query.ask(ctx, body);
  }

  @Post("ask/stream")
  @Protected()
  @PolicyCheck("query", "ontology-nl")
  askStream(
    @DaemonScope() ctx: TenantContextHeaders,
    @Body() body: AskOntologyQueryDto,
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ) {
    const controller = new AbortController();
    req.on("close", () => controller.abort());
    return this.query.askStream(ctx, body, res, controller.signal);
  }
}
