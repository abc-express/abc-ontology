import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { TenantContextHeaders } from "../platform/tenant-context";
import { IngestPipelineService } from "./ingest-pipeline.service";

export interface IngestScheduleRow {
  id: string;
  tenantId: string;
  domainId: string;
  sourceId: string;
  cronExpr: string;
  enabled: boolean;
  lastRunAt?: string;
  lastStatus?: string;
  lastError?: string;
}

interface CreateScheduleInput {
  sourceId: string;
  cronExpr: string;
  enabled?: boolean;
}

/** Minimal 5-field cron: minute hour dom month dow (supports star, numbers, step syntax). */
function cronMatches(expr: string, date: Date): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return false;
  const fields = [
    date.getUTCMinutes(),
    date.getUTCHours(),
    date.getUTCDate(),
    date.getUTCMonth() + 1,
    date.getUTCDay(),
  ];
  for (let i = 0; i < 5; i++) {
    const spec = parts[i]!;
    if (spec === "*") continue;
    if (spec.startsWith("*/")) {
      const step = Number(spec.slice(2));
      if (!Number.isFinite(step) || step <= 0) return false;
      if (fields[i]! % step !== 0) return false;
      continue;
    }
    const values = spec.split(",").map((v) => Number(v.trim()));
    if (!values.includes(fields[i]!)) return false;
  }
  return true;
}

@Injectable()
export class IngestScheduleService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private readonly lastMinute = new Map<string, string>();

  constructor(private readonly pipeline: IngestPipelineService) {}

  onModuleInit(): void {
    const pollSec = Number(process.env.DAEMON_INGEST_SCHEDULE_POLL_SECONDS ?? "60");
    if (!process.env.DAEMON_POSTGRES_URL) return;
    this.timer = setInterval(() => {
      void this.tick().catch((err) => {
        console.error("[ingest-scheduler]", err);
      });
    }, Math.max(15, pollSec) * 1000);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async getPg() {
    const { PostgresClient } = await import(
      "@daemon/data-platform/operational-store"
    );
    return new PostgresClient({
      connectionString: process.env.DAEMON_POSTGRES_URL!,
    });
  }

  async list(ctx: TenantContextHeaders): Promise<IngestScheduleRow[]> {
    const pg = await this.getPg();
    try {
      const res = await pg.query<{
        id: string;
        tenant_id: string;
        domain_id: string;
        source_id: string;
        cron_expr: string;
        enabled: boolean;
        last_run_at: Date | null;
        last_status: string | null;
        last_error: string | null;
      }>(
        `SELECT id, tenant_id, domain_id, source_id, cron_expr, enabled,
                last_run_at, last_status, last_error
         FROM daemon_ingest_schedules
         WHERE tenant_id = $1 AND domain_id = $2
         ORDER BY created_at DESC`,
        [ctx.tenantId, ctx.domainId],
      );
      return res.rows.map(rowToSchedule);
    } finally {
      await pg.close();
    }
  }

  async create(
    ctx: TenantContextHeaders,
    input: CreateScheduleInput,
  ): Promise<IngestScheduleRow> {
    const id = `sched-${randomUUID()}`;
    const pg = await this.getPg();
    try {
      await pg.query(
        `INSERT INTO daemon_ingest_schedules
         (id, tenant_id, domain_id, source_id, cron_expr, enabled)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          id,
          ctx.tenantId,
          ctx.domainId,
          input.sourceId,
          input.cronExpr,
          input.enabled !== false,
        ],
      );
      return {
        id,
        tenantId: ctx.tenantId,
        domainId: ctx.domainId,
        sourceId: input.sourceId,
        cronExpr: input.cronExpr,
        enabled: input.enabled !== false,
      };
    } finally {
      await pg.close();
    }
  }

  async patch(
    ctx: TenantContextHeaders,
    id: string,
    patch: Partial<Pick<CreateScheduleInput, "cronExpr" | "enabled" | "sourceId">>,
  ): Promise<IngestScheduleRow> {
    const pg = await this.getPg();
    try {
      const existing = await pg.query<{ cron_expr: string; enabled: boolean; source_id: string }>(
        `SELECT cron_expr, enabled, source_id FROM daemon_ingest_schedules
         WHERE id = $1 AND tenant_id = $2 AND domain_id = $3`,
        [id, ctx.tenantId, ctx.domainId],
      );
      if (!existing.rows[0]) {
        throw new Error(`schedule not found: ${id}`);
      }
      const row = existing.rows[0];
      await pg.query(
        `UPDATE daemon_ingest_schedules SET
           cron_expr = $4, enabled = $5, source_id = $6, updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2 AND domain_id = $3`,
        [
          id,
          ctx.tenantId,
          ctx.domainId,
          patch.cronExpr ?? row.cron_expr,
          patch.enabled ?? row.enabled,
          patch.sourceId ?? row.source_id,
        ],
      );
      const listed = await this.list(ctx);
      const found = listed.find((s) => s.id === id);
      if (!found) throw new Error(`schedule not found after patch: ${id}`);
      return found;
    } finally {
      await pg.close();
    }
  }

  private async tick(): Promise<void> {
    const now = new Date();
    const minuteKey = `${now.toISOString().slice(0, 16)}`;
    const pg = await this.getPg();
    try {
      const res = await pg.query<{
        id: string;
        tenant_id: string;
        domain_id: string;
        source_id: string;
        cron_expr: string;
      }>(
        `SELECT id, tenant_id, domain_id, source_id, cron_expr
         FROM daemon_ingest_schedules WHERE enabled = true`,
      );
      for (const row of res.rows) {
        if (!cronMatches(row.cron_expr, now)) continue;
        if (this.lastMinute.get(row.id) === minuteKey) continue;
        this.lastMinute.set(row.id, minuteKey);
        const ctx: TenantContextHeaders = {
          tenantId: row.tenant_id,
          domainId: row.domain_id,
        };
        try {
          await this.pipeline.runSource(ctx, row.source_id);
          await pg.query(
            `UPDATE daemon_ingest_schedules SET last_run_at = NOW(), last_status = 'ok', last_error = NULL, updated_at = NOW() WHERE id = $1`,
            [row.id],
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await pg.query(
            `UPDATE daemon_ingest_schedules SET last_run_at = NOW(), last_status = 'failed', last_error = $2, updated_at = NOW() WHERE id = $1`,
            [row.id, message],
          );
        }
      }
    } finally {
      await pg.close();
    }
  }
}

function rowToSchedule(row: {
  id: string;
  tenant_id: string;
  domain_id: string;
  source_id: string;
  cron_expr: string;
  enabled: boolean;
  last_run_at: Date | null;
  last_status: string | null;
  last_error: string | null;
}): IngestScheduleRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    domainId: row.domain_id,
    sourceId: row.source_id,
    cronExpr: row.cron_expr,
    enabled: row.enabled,
    lastRunAt: row.last_run_at?.toISOString(),
    lastStatus: row.last_status ?? undefined,
    lastError: row.last_error ?? undefined,
  };
}
