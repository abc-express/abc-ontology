import { Injectable } from "@nestjs/common";
import { SourceCatalog } from "@daemon/collect-sensing/orchestrator/source-catalog";
import type { TenantContextHeaders } from "../platform/tenant-context";
@Injectable()
export class OpsService {
  private readonly catalog = SourceCatalog.fromYamlFile();

  health() {
    return {
      status: "ok",
      postgres: Boolean(process.env.DAEMON_POSTGRES_URL),
      redis: Boolean(process.env.DAEMON_REDIS_URL),
      nats: process.env.DAEMON_NATS_URL ?? null,
    };
  }

  listConnectors() {
    return {
      sources: this.catalog.list().map((s) => ({
        id: s.id,
        enabled: s.enabled,
        connectorType: s.connector.type,
      })),
    };
  }

  async listJobs(ctx: TenantContextHeaders) {
    const url = process.env.DAEMON_POSTGRES_URL;
    if (!url) {
      return { items: [], note: "DAEMON_POSTGRES_URL not set" };
    }
    const { PostgresClient } = await import(
      "@daemon/data-platform/operational-store"
    );
    const client = new PostgresClient({ connectionString: url });
    const { rows } = await client.query(
      `SELECT id, source_id, cron_expr, enabled, last_run_at, last_status, last_error
       FROM daemon_ingest_schedules
       WHERE tenant_id = $1 AND domain_id = $2
       ORDER BY updated_at DESC
       LIMIT 50`,
      [ctx.tenantId, ctx.domainId],
    );
    return { items: rows };
  }
}
