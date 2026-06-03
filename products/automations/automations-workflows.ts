import type { WorkflowStep } from "@daemon/action-runtime/workflow-engine/workflow-orchestrator.js";
import type { DaemonSession } from "@daemon/platform-types";
import { entityId, ontologyId } from "@daemon/platform-types";
import type { EntityId, OntologyId } from "@daemon/platform-types";
import type { ApprovalDecision } from "@daemon/read-write-loops/loop-controller/approval-gates.js";
import type { LoopOutcome } from "@daemon/read-write-loops/loop-controller/loop-orchestrator.js";
import type { LoopRequest } from "@daemon/read-write-loops/loop-controller/loop-orchestrator.js";
import { ProductRuntime } from "../shared/product-runtime.js";
import { ApprovalRunner } from "./approval-runner.js";
import { TaskOrchestrator, type AutomationRunResult } from "./task-orchestrator.js";

export interface AutomationLoopInput {
  ontologyId: OntologyId | string;
  entityId: EntityId | string;
  patch: Record<string, unknown>;
  idempotencyKey?: string;
}

/**
 * Facade for automation workflows: task orchestration plus approval-gated writes.
 */
export class AutomationsWorkflows {
  private readonly tasks: TaskOrchestrator;
  private readonly approvals: ApprovalRunner;

  constructor(runtime: ProductRuntime = new ProductRuntime()) {
    this.tasks = new TaskOrchestrator(runtime);
    this.approvals = new ApprovalRunner(runtime);
  }

  private toLoopRequest(session: DaemonSession, loop: AutomationLoopInput): LoopRequest {
    return {
      session,
      ontologyId:
        typeof loop.ontologyId === "string" ? ontologyId(loop.ontologyId) : loop.ontologyId,
      entityId: typeof loop.entityId === "string" ? entityId(loop.entityId) : loop.entityId,
      patch: loop.patch,
      idempotencyKey: loop.idempotencyKey,
    };
  }

  /** Run workflow steps and optionally commit an ontology write loop. */
  async run(
    session: DaemonSession,
    steps: WorkflowStep[],
    loop?: AutomationLoopInput,
  ): Promise<AutomationRunResult> {
    const loopRequest = loop ? this.toLoopRequest(session, loop) : undefined;
    return this.tasks.run(steps, loopRequest);
  }

  /** Evaluate whether a patch satisfies approval rules (no write). */
  evaluateApproval(
    patch: Record<string, unknown>,
    approvals: string[],
  ): ApprovalDecision {
    return this.approvals.evaluate(patch, approvals);
  }

  /** Run an approval-gated write loop. */
  approve(
    session: DaemonSession,
    loop: AutomationLoopInput,
    approvals: string[],
  ): LoopOutcome {
    return this.approvals.run({
      loop: this.toLoopRequest(session, loop),
      approvals,
    });
  }
}
