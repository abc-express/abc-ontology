import { Injectable } from "@nestjs/common";
import { SourceCatalog } from "@daemon/collect-sensing/orchestrator/source-catalog.js";
import { DaemonRuntime } from "../platform/daemon-runtime";
import type { TenantContextHeaders } from "../platform/tenant-context";

export interface DataHealthSummary {
  generatedAt: string;
  sources: { configured: number };
  ingestSchedules: { total: number; failed: number };
  lakehouse: Record<string, unknown>;
}

@Injectable()
export class DataHealthService {
  constructor(private readonly runtime: DaemonRuntime) {}

  async summary(ctx: TenantContextHeaders): Promise<DataHealthSummary> {
    this.runtime.assertAllowed("read", "lakehouse");
    const scope = { tenantId: ctx.tenantId, domainId: ctx.domainId };
    const lakehouse = await this.runtime.lakehouseBronzeReader.summarize(scope, {});

    let scheduleStats = { total: 0, failed: 0 };
    if (process.env.DAEMON_POSTGRES_URL) {
      const { PostgresClient } = await import(
        "@daemon/data-platform/operational-store"
      );
      const pg = new PostgresClient({
        connectionString: process.env.DAEMON_POSTGRES_URL,
      });
      try {
        const res = await pg.query<{ total: string; failed: string }>(
          `SELECT COUNT(*)::text AS total,
                  COUNT(*) FILTER (WHERE last_status = 'failed')::text AS failed
           FROM daemon_ingest_schedules
           WHERE tenant_id = $1 AND domain_id = $2`,
          [ctx.tenantId, ctx.domainId],
        );
        scheduleStats = {
          total: Number(res.rows[0]?.total ?? 0),
          failed: Number(res.rows[0]?.failed ?? 0),
        };
      } finally {
        await pg.close();
      }
    }

    const catalog = SourceCatalog.fromYamlFile();
    const sources = catalog.list().length;

    return {
      generatedAt: new Date().toISOString(),
      sources: { configured: sources },
      ingestSchedules: scheduleStats,
      lakehouse: lakehouse as unknown as Record<string, unknown>,
    };
  }
}
