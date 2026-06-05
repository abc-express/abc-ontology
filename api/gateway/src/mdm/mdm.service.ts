import { Injectable } from "@nestjs/common";
import { PostgresClient } from "@daemon/data-platform/operational-store";
import { MdmStore } from "@daemon/data-platform/mdm/mdm-store";
import { PILOT_LOCATIONS } from "@daemon/data-platform/mdm/pilot-locations";
import { DaemonRuntime } from "../platform/daemon-runtime";
import type { TenantContextHeaders } from "../platform/tenant-context";

@Injectable()
export class MdmService {
  private store: MdmStore | null = null;
  private seeded = false;

  constructor(private readonly runtime: DaemonRuntime) {}

  private async getStore(): Promise<MdmStore | null> {
    const url = process.env.DAEMON_POSTGRES_URL;
    if (!url) return null;
    if (!this.store) {
      const pg = new PostgresClient({ connectionString: url });
      this.store = new MdmStore(pg);
    }
    if (!this.seeded) {
      await this.store.seedPilotLocations(PILOT_LOCATIONS);
      this.seeded = true;
    }
    return this.store;
  }

  async listLocations(ctx: TenantContextHeaders, limit?: number) {
    this.runtime.assertAllowed("read", "ontology");
    const store = await this.getStore();
    if (!store) return { locations: [], mode: "memory_unavailable" };
    const locations = await store.listLocations(limit ?? 100);
    return { tenantId: ctx.tenantId, domainId: ctx.domainId, locations };
  }

  async listServiceAreas(ctx: TenantContextHeaders, limit?: number) {
    this.runtime.assertAllowed("read", "ontology");
    const store = await this.getStore();
    if (!store) return { serviceAreas: [], mode: "memory_unavailable" };
    const serviceAreas = await store.listServiceAreas(limit ?? 100);
    return { tenantId: ctx.tenantId, domainId: ctx.domainId, serviceAreas };
  }

  async listConflicts(ctx: TenantContextHeaders, entityType?: string) {
    this.runtime.assertAllowed("read", "ontology");
    const store = await this.getStore();
    if (!store) return { conflicts: [], mode: "memory_unavailable" };
    const conflicts = await store.listOpenConflicts(entityType);
    return { tenantId: ctx.tenantId, domainId: ctx.domainId, conflicts };
  }

  async getSourceRegistry() {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { parse } = await import("yaml");
    const root = process.env.DAEMON_REPO_ROOT ?? process.cwd();
    const path = join(root, "configs", "abc-express", "source-system-registry.yaml");
    return parse(readFileSync(path, "utf8"));
  }
}
