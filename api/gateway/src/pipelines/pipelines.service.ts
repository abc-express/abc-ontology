import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { PipelineRunner, type PipelineDag } from "@daemon/products/pipeline-builder/pipeline-runner.js";
import { ProductRuntime } from "@daemon/products/shared/product-runtime.js";
import { DaemonRuntime } from "../platform/daemon-runtime";
import type { TenantContextHeaders } from "../platform/tenant-context";

@Injectable()
export class PipelinesService {
  constructor(private readonly daemon: DaemonRuntime) {}

  private runner(ctx: TenantContextHeaders): PipelineRunner {
    const product = ProductRuntime.fromGatewayBridge({
      reads: this.daemon.reads,
      writes: this.daemon.writes,
      store: this.daemon.store,
      policy: this.daemon.policy,
      search: this.daemon.search,
      scope: { tenantId: ctx.tenantId, domainId: ctx.domainId },
    });
    return new PipelineRunner(product);
  }

  private async getPg() {
    const { PostgresClient } = await import(
      "@daemon/data-platform/operational-store"
    );
    return new PostgresClient({
      connectionString: process.env.DAEMON_POSTGRES_URL!,
    });
  }

  async runPipeline(
    ctx: TenantContextHeaders,
    pipelineId: string,
    dag: PipelineDag,
  ) {
    this.daemon.assertAllowed("write", "pipeline");
    const result = await this.runner(ctx).run(pipelineId, dag, {
      tenantId: ctx.tenantId,
      domainId: ctx.domainId,
    });
    if (!process.env.DAEMON_POSTGRES_URL) {
      return result;
    }
    const pg = await this.getPg();
    const id = result.runId ?? `prun-${randomUUID()}`;
    try {
      await pg.query(
        `INSERT INTO daemon_pipeline_runs
         (id, tenant_id, domain_id, pipeline_id, status, dag, result, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, NOW())`,
        [
          id,
          ctx.tenantId,
          ctx.domainId,
          pipelineId,
          result.status,
          JSON.stringify(dag),
          JSON.stringify(result),
        ],
      );
    } finally {
      await pg.close();
    }
    return { ...result, persisted: true };
  }
}
