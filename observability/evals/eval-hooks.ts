export interface EvalEvent {
  id: string;
  name: string;
  score: number;
  passed: boolean;
  recordedAt: string;
  metadata?: Record<string, unknown>;
}

export interface RecordEvalInput {
  name: string;
  score: number;
  threshold?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Lightweight in-memory eval recorder for agent/workflow quality checks.
 * Export events to your analytics pipeline via {@link EvalRecorder.exportJsonl}.
 */
export class EvalRecorder {
  private readonly events: EvalEvent[] = [];

  record(input: RecordEvalInput): EvalEvent {
    const threshold = input.threshold ?? 0.7;
    const event: EvalEvent = {
      id: `eval-${this.events.length + 1}`,
      name: input.name,
      score: input.score,
      passed: input.score >= threshold,
      recordedAt: new Date().toISOString(),
      metadata: input.metadata,
    };
    this.events.push(event);
    return event;
  }

  list(): readonly EvalEvent[] {
    return this.events;
  }

  passRate(): number {
    if (this.events.length === 0) return 1;
    const passed = this.events.filter((e) => e.passed).length;
    return passed / this.events.length;
  }

  exportJsonl(): string {
    return this.events.map((e) => JSON.stringify(e)).join("\n");
  }

  clear(): void {
    this.events.length = 0;
  }
}

export const globalEvalRecorder = new EvalRecorder();
