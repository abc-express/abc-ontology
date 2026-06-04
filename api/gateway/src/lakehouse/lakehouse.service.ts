import { Injectable } from "@nestjs/common";
import { DaemonRuntime } from "../platform/daemon-runtime";
import type { TenantContextHeaders } from "../platform/tenant-context";

@Injectable()
export class LakehouseService {
  constructor(private readonly runtime: DaemonRuntime) {}

  async listEvents(
    ctx: TenantContextHeaders,
    query: {
      since?: string;
      limit?: string;
      entityType?: string;
      ontologyId?: string;
      changeType?: string;
    },
  ) {
    this.runtime.assertAllowed("read", "lakehouse");
    const scope = { tenantId: ctx.tenantId, domainId: ctx.domainId };
    const changeType =
      query.changeType === "register" || query.changeType === "patch"
        ? query.changeType
        : undefined;
    const events = await this.runtime.lakehouseBronze.listEvents(scope, {
      since: query.since,
      limit: query.limit ? Number(query.limit) : undefined,
      entityType: query.entityType,
      ontologyId: query.ontologyId,
      changeType,
    });
    return { events, count: events.length };
  }

  async summarize(
    ctx: TenantContextHeaders,
    query: { since?: string } = {},
  ) {
    this.runtime.assertAllowed("read", "lakehouse");
    const scope = { tenantId: ctx.tenantId, domainId: ctx.domainId };
    return this.runtime.lakehouseBronzeReader.summarize(scope, {
      since: query.since,
    });
  }
}
