import { Controller, Get, Query } from "@nestjs/common";
import { Protected } from "../auth/protected.decorator";
import { PolicyCheck } from "../auth/policy-check.decorator";
import { DaemonScope } from "../auth/daemon-scope.decorator";
import type { TenantContextHeaders } from "../platform/tenant-context";
import { MdmService } from "./mdm.service";

@Controller("v1/ontology")
export class MdmController {
  constructor(private readonly mdm: MdmService) {}

  @Get("locations")
  @Protected()
  @PolicyCheck("read", "ontology")
  listLocations(
    @DaemonScope() ctx: TenantContextHeaders,
    @Query("limit") limit?: string,
  ) {
    return this.mdm.listLocations(ctx, limit ? Number(limit) : undefined);
  }

  @Get("service-areas")
  @Protected()
  @PolicyCheck("read", "ontology")
  listServiceAreas(
    @DaemonScope() ctx: TenantContextHeaders,
    @Query("limit") limit?: string,
  ) {
    return this.mdm.listServiceAreas(ctx, limit ? Number(limit) : undefined);
  }

  @Get("conflicts")
  @Protected()
  @PolicyCheck("read", "ontology")
  listConflicts(
    @DaemonScope() ctx: TenantContextHeaders,
    @Query("entityType") entityType?: string,
  ) {
    return this.mdm.listConflicts(ctx, entityType);
  }

  @Get("source-registry")
  @Protected()
  @PolicyCheck("read", "ontology")
  sourceRegistry() {
    return this.mdm.getSourceRegistry();
  }
}
