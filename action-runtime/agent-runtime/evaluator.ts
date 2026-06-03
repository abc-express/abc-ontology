/** Spec: action-runtime/agent-runtime/evaluator.ts */
import { DaemonError, ErrorCodes } from "@daemon/platform-types";

export interface Criterion {
  name: string;
  weight: number;
  /** Returns a normalized score in [0, 1] for the candidate. */
  score: (candidate: unknown) => number;
}

export interface Evaluation {
  score: number;
  passed: boolean;
  breakdown: Record<string, number>;
}

/**
 * Scores a candidate result against weighted criteria and renders a pass/fail
 * verdict against a threshold. Weights are normalized so the aggregate score is
 * always in [0, 1] regardless of how callers scale individual weights.
 */
export class Evaluator {
  private readonly totalWeight: number;

  constructor(
    private readonly criteria: Criterion[],
    private readonly threshold = 0.6,
  ) {
    if (criteria.length === 0) {
      throw new DaemonError(ErrorCodes.VALIDATION, "at least one criterion required", 400);
    }
    this.totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
    if (this.totalWeight <= 0) {
      throw new DaemonError(ErrorCodes.VALIDATION, "weights must sum to a positive value", 400);
    }
  }

  evaluate(candidate: unknown): Evaluation {
    const breakdown: Record<string, number> = {};
    let aggregate = 0;
    for (const criterion of this.criteria) {
      const raw = criterion.score(candidate);
      const clamped = Math.max(0, Math.min(1, raw));
      breakdown[criterion.name] = clamped;
      aggregate += clamped * (criterion.weight / this.totalWeight);
    }
    return {
      score: aggregate,
      passed: aggregate >= this.threshold,
      breakdown,
    };
  }
}
