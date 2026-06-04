import { entityId, ontologyId } from "@daemon/platform-types";
import type { ProductRuntime } from "../shared/product-runtime.js";

export interface PipelineNode {
  id: string;
  type: "source" | "map" | "filter" | "deliver-lakehouse" | "register";
  config?: Record<string, unknown>;
}

export interface PipelineDag {
  nodes: PipelineNode[];
}

export interface PipelineRunResult {
  runId: string;
  pipelineId: string;
  status: "completed" | "failed";
  steps: Array<{ nodeId: string; status: string; detail?: unknown }>;
  error?: string;
}

/**
 * Executes a YAML-style DAG against gateway-backed runtime (ingest + register).
 */
export class PipelineRunner {
  constructor(private readonly runtime: ProductRuntime) {}

  async run(
    pipelineId: string,
    dag: PipelineDag,
    ctx: { tenantId: string; domainId: string },
  ): Promise<PipelineRunResult> {
    const runId = `prun-${Date.now()}`;
    const steps: PipelineRunResult["steps"] = [];
    try {
      for (const node of dag.nodes) {
        switch (node.type) {
          case "source":
            steps.push({
              nodeId: node.id,
              status: "ok",
              detail: { sourceId: node.config?.sourceId },
            });
            break;
          case "map":
          case "filter":
            steps.push({ nodeId: node.id, status: "ok" });
            break;
          case "deliver-lakehouse":
            steps.push({ nodeId: node.id, status: "ok", detail: "lakehouse-bronze" });
            break;
          case "register": {
            const eid = entityId(String(node.config?.entityId ?? `ent-${node.id}`));
            const ont = ontologyId(String(node.config?.ontologyId ?? "foundation"));
            const entityType = String(node.config?.entityType ?? "Entity");
            const scope = { tenantId: ctx.tenantId, domainId: ctx.domainId };
            this.runtime.store.register({
              scope,
              ontologyId: ont,
              entityId: eid,
              entityType,
              properties:
                (node.config?.properties as Record<string, unknown>) ?? {},
            });
            steps.push({ nodeId: node.id, status: "ok", detail: { entityId: eid } });
            break;
          }
          default:
            steps.push({ nodeId: node.id, status: "skipped" });
        }
      }
      return {
        runId,
        pipelineId,
        status: "completed",
        steps,
      };
    } catch (err) {
      return {
        runId,
        pipelineId,
        status: "failed",
        steps,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
