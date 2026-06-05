import { Body, Controller, Get, Post } from "@nestjs/common";
import { Protected } from "../auth/protected.decorator";
import { PolicyCheck } from "../auth/policy-check.decorator";
import { DaemonScope } from "../auth/daemon-scope.decorator";
import { Session } from "../auth/session.decorator";
import type { TenantContextHeaders } from "../platform/tenant-context";
import type { DaemonSession } from "@daemon/platform-types";
import { ActionsService } from "./actions.service";

@Controller("v1/actions")
export class ActionsController {
  constructor(private readonly actions: ActionsService) {}

  @Get("catalog")
  @Protected()
  @PolicyCheck("read", "ontology")
  catalog() {
    return this.actions.getActionCatalog();
  }

  @Post("resolve-location-conflict")
  @Protected()
  @PolicyCheck("write", "entity")
  resolveLocationConflict(
    @DaemonScope() ctx: TenantContextHeaders,
    @Session() session: DaemonSession,
    @Body()
    body: {
      conflictId: string;
      canonicalId: string;
      resolvedValue: string;
      reasonCode?: string;
      idempotencyKey?: string;
    },
  ) {
    return this.actions.resolveLocationConflict(ctx, session, body);
  }

  @Post("create-signal")
  @Protected()
  @PolicyCheck("write", "entity")
  createSignal(
    @DaemonScope() ctx: TenantContextHeaders,
    @Session() session: DaemonSession,
    @Body()
    body: {
      signalId: string;
      signalType: string;
      severity: string;
      accountRef?: string;
      idempotencyKey?: string;
    },
  ) {
    return this.actions.createSignal(ctx, session, body);
  }

  @Post("update-service-area-coverage")
  @Protected()
  @PolicyCheck("write", "entity")
  updateServiceAreaCoverage(
    @DaemonScope() ctx: TenantContextHeaders,
    @Session() session: DaemonSession,
    @Body()
    body: {
      coverageId: string;
      locationId: string;
      coverageStatus: "active" | "inactive" | "pending" | "suspended";
      servingRo?: string;
      servingAgent?: string;
      slaHours?: number;
      is3t?: boolean;
      sourceSystem?: string;
      reasonCode?: string;
      idempotencyKey?: string;
    },
  ) {
    return this.actions.updateServiceAreaCoverage(ctx, session, body);
  }
}
