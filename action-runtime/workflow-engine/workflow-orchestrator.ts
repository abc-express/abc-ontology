/** Spec: action-runtime/workflow-engine/workflow-orchestrator.ts */
export interface WorkflowStep {
  id: string;
  action: string;
}

export class WorkflowOrchestrator {
  async run(steps: WorkflowStep[]): Promise<string[]> {
    return steps.map((s) => `ok:${s.id}:${s.action}`);
  }
}
