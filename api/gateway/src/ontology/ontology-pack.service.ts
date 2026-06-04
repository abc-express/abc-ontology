import { Injectable } from "@nestjs/common";
import { DaemonRuntime } from "../platform/daemon-runtime";
import type { TenantContextHeaders } from "../platform/tenant-context";

@Injectable()
export class OntologyPackService {
  constructor(private readonly runtime: DaemonRuntime) {}

  packResolution(
    ctx: TenantContextHeaders,
    query: { environment?: string; packBranch?: string },
  ) {
    this.runtime.assertAllowed("read", "ontology");
    const tenant = this.runtime.tenants.require(ctx.tenantId);
    const domain = this.runtime.domains.require(ctx.domainId);
    const env =
      query.environment ??
      process.env.DAEMON_PACK_ENVIRONMENT ??
      "production";
    const branch =
      query.packBranch ??
      (domain as { packBranch?: string }).packBranch ??
      "main";
    const resolved = this.runtime.packs.resolve(tenant, ctx.domainId, {
      packBranch: branch,
      environment: env,
    });
    return {
      tenantId: ctx.tenantId,
      domainId: ctx.domainId,
      environment: resolved.environment,
      packBranch: resolved.packBranch,
      extensionPack: domain.extensionPack ?? null,
      ontologyId: resolved.ontologyId,
      packVersion: resolved.packVersion,
      entityTypes: resolved.entityTypes,
    };
  }
}
