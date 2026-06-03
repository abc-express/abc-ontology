import { Injectable } from "@nestjs/common";
import type { WorkflowStep } from "@daemon/action-runtime/workflow-engine/workflow-orchestrator.js";
import type { DaemonSession } from "@daemon/platform-types";
import {
  AutomationsWorkflows,
  type AutomationLoopInput,
} from "@daemon/products/automations/automations-workflows.js";
import type { ApprovalDecision } from "@daemon/read-write-loops/loop-controller/approval-gates.js";
import type { LoopOutcome } from "@daemon/read-write-loops/loop-controller/loop-orchestrator.js";
import type { AutomationRunResult } from "@daemon/products/automations/task-orchestrator.js";

export interface AutomationsRunBody {
  steps: WorkflowStep[];
  loop?: AutomationLoopInput;
}

export interface AutomationsEvaluateBody {
  patch: Record<string, unknown>;
  approvals: string[];
}

export interface AutomationsApproveBody {
  loop: AutomationLoopInput;
  approvals: string[];
}

@Injectable()
export class AutomationsService {
  private readonly flows = new AutomationsWorkflows();

  run(session: DaemonSession, body: AutomationsRunBody): Promise<AutomationRunResult> {
    return this.flows.run(session, body.steps ?? [], body.loop);
  }

  evaluate(body: AutomationsEvaluateBody): ApprovalDecision {
    return this.flows.evaluateApproval(body.patch ?? {}, body.approvals ?? []);
  }

  approve(session: DaemonSession, body: AutomationsApproveBody): LoopOutcome {
    return this.flows.approve(session, body.loop, body.approvals ?? []);
  }
}
