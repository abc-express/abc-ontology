import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  EvalRunner,
  type EvalSuite,
} from "@daemon/products/aip-evals/eval-runner.js";
import { ProductRuntime } from "@daemon/products/shared/product-runtime.js";
import { DaemonRuntime } from "../platform/daemon-runtime";
import type { TenantContextHeaders } from "../platform/tenant-context";

export interface EvalRecordInput {
  suiteId: string;
  name: string;
  score: number;
  threshold?: number;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class EvalsService {
  constructor(private readonly daemon: DaemonRuntime) {}

  private pgUrl(): string | undefined {
    return process.env.DAEMON_POSTGRES_URL;
  }

  private runner(ctx: TenantContextHeaders): EvalRunner {
    const product = ProductRuntime.fromGatewayBridge({
      reads: this.daemon.reads,
      writes: this.daemon.writes,
      store: this.daemon.store,
      policy: this.daemon.policy,
      search: this.daemon.search,
      scope: { tenantId: ctx.tenantId, domainId: ctx.domainId },
    });
    return new EvalRunner(product);
  }

  async runEval(ctx: TenantContextHeaders, suite: EvalSuite) {
    this.daemon.assertAllowed("read", "eval");
    const result = await this.runner(ctx).run(suite);
    const url = this.pgUrl();
    if (!url) {
      return { ...result, persisted: false };
    }
    const { PostgresClient } = await import(
      "@daemon/data-platform/operational-store"
    );
    const client = new PostgresClient({ connectionString: url });
    const id = result.runId ?? `eval-${randomUUID()}`;
    await client.query(
      `INSERT INTO daemon_eval_runs (id, tenant_id, domain_id, suite_id, status, scores, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())`,
      [
        id,
        ctx.tenantId,
        ctx.domainId,
        suite.id,
        result.status,
        JSON.stringify(result.scores),
      ],
    );
    await client.close();
    return { ...result, persisted: true };
  }

  async record(ctx: TenantContextHeaders, input: EvalRecordInput) {
    const url = this.pgUrl();
    const threshold = input.threshold ?? 0.7;
    const passed = input.score >= threshold;
    const event = {
      name: input.name,
      score: input.score,
      passed,
      metadata: input.metadata ?? {},
      recordedAt: new Date().toISOString(),
    };
    if (!url) {
      return { id: `mem-${randomUUID()}`, persisted: false, ...event };
    }
    const { PostgresClient } = await import(
      "@daemon/data-platform/operational-store"
    );
    const client = new PostgresClient({ connectionString: url });
    const id = `eval-${randomUUID()}`;
    const scores = [event];
    await client.query(
      `INSERT INTO daemon_eval_runs (id, tenant_id, domain_id, suite_id, status, scores, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())`,
      [
        id,
        ctx.tenantId,
        ctx.domainId,
        input.suiteId,
        passed ? "passed" : "failed",
        JSON.stringify(scores),
      ],
    );
    await client.close();
    return { id, persisted: true, suiteId: input.suiteId, ...event };
  }

  async list(ctx: TenantContextHeaders, limit = 20) {
    const url = this.pgUrl();
    if (!url) return { items: [] };
    const { PostgresClient } = await import(
      "@daemon/data-platform/operational-store"
    );
    const client = new PostgresClient({ connectionString: url });
    const { rows } = await client.query(
      `SELECT id, suite_id, status, scores, created_at, completed_at
       FROM daemon_eval_runs
       WHERE tenant_id = $1 AND domain_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [ctx.tenantId, ctx.domainId, limit],
    );
    await client.close();
    return { items: rows };
  }
}
