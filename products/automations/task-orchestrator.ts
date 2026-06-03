import {
  WorkflowOrchestrator,
  type WorkflowStep,
} from "@daemon/action-runtime/workflow-engine/workflow-orchestrator.js";
import type { LoopOutcome } from "@daemon/read-write-loops/loop-controller/loop-orchestrator.js";
import type { LoopRequest } from "@daemon/read-write-loops/loop-controller/loop-orchestrator.js";
import type { ProductRuntime } from "../shared/product-runtime.js";

export interface AutomationRunResult {
  workflowResults: string[];
  loop?: LoopOutcome;
}

/**
 * Runs declarative workflow steps, then optionally commits an ontology write loop.
 */
export class TaskOrchestrator {
  private readonly workflows = new WorkflowOrchestrator();

  constructor(private readonly runtime: ProductRuntime) {}

  async run(
    steps: WorkflowStep[],
    loopRequest?: LoopRequest,
  ): Promise<AutomationRunResult> {
    this.runtime.assertAllowed("write", "entity");
    const workflowResults = await this.workflows.run(steps);
    if (!loopRequest) {
      return { workflowResults };
    }
    const loop = this.runtime.createLoop().run(loopRequest);
    return { workflowResults, loop };
  }
}
