/** Spec: action-runtime/workflow-engine/compensation-handler.ts */
import { DaemonError, ErrorCodes } from "@daemon/platform-types";

export interface CompletedStep {
  id: string;
  compensate: () => Promise<void> | void;
}

export interface CompensationOutcome {
  id: string;
  ok: boolean;
  error?: string;
}

/**
 * Implements saga-style compensation. As forward steps complete they register a
 * compensating action; on failure the handler unwinds them in reverse order
 * (LIFO), continuing past individual compensation errors so cleanup is
 * best-effort and fully reported.
 */
export class CompensationHandler {
  private readonly completed: CompletedStep[] = [];

  record(step: CompletedStep): void {
    if (!step.id) {
      throw new DaemonError(ErrorCodes.VALIDATION, "step id required", 400);
    }
    this.completed.push(step);
  }

  /** Run all registered compensations in reverse, returning per-step outcomes. */
  async rollback(): Promise<CompensationOutcome[]> {
    const outcomes: CompensationOutcome[] = [];
    while (this.completed.length > 0) {
      const step = this.completed.pop()!;
      try {
        await step.compensate();
        outcomes.push({ id: step.id, ok: true });
      } catch (err) {
        outcomes.push({
          id: step.id,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return outcomes;
  }

  pendingCount(): number {
    return this.completed.length;
  }
}
