import { Injectable } from "@nestjs/common";
import { LakehouseExporter } from "@daemon/data-platform/lakehouse/export/lakehouse-exporter";
import { DaemonRuntime } from "../platform/daemon-runtime";
import type { TenantContextHeaders } from "../platform/tenant-context";

@Injectable()
export class LakehouseExportService {
  private readonly exporter = LakehouseExporter.fromEnv();

  constructor(private readonly runtime: DaemonRuntime) {}

  async startExport(
    ctx: TenantContextHeaders,
    body: { since?: string; limit?: number; format?: "jsonl" | "parquet" },
  ) {
    this.runtime.assertAllowed("read", "lakehouse");
    const scope = { tenantId: ctx.tenantId, domainId: ctx.domainId };
    const result = await this.exporter.runExport(scope, body);
    return { status: "completed", ...result };
  }

  async getExport(ctx: TenantContextHeaders, exportId: string) {
    this.runtime.assertAllowed("read", "lakehouse");
    const scope = { tenantId: ctx.tenantId, domainId: ctx.domainId };
    const row = await this.exporter.getExport(exportId, scope);
    if (!row) return { status: "not_found", exportId };
    return row;
  }
}
