/** Spec: action-runtime/agent-runtime/planner.ts */
import { DaemonError, ErrorCodes } from "@daemon/platform-types";

export interface PlanStep {
  id: string;
  capability: string;
  description: string;
  dependsOn: string[];
}

export interface Plan {
  goal: string;
  steps: PlanStep[];
}

export interface SubGoal {
  capability: string;
  description: string;
}

/**
 * Decomposes a high-level goal into an ordered plan. Each subgoal must map to a
 * known capability; steps form a sequential dependency chain so downstream
 * executors (scheduler, dispatcher) have explicit ordering to honor.
 */
export class Planner {
  constructor(private readonly capabilities: ReadonlySet<string>) {}

  plan(goal: string, subgoals: SubGoal[]): Plan {
    if (!goal.trim()) {
      throw new DaemonError(ErrorCodes.VALIDATION, "goal must not be empty", 400);
    }
    if (subgoals.length === 0) {
      throw new DaemonError(ErrorCodes.VALIDATION, "at least one subgoal required", 400);
    }
    const steps: PlanStep[] = subgoals.map((sub, index) => {
      if (!this.capabilities.has(sub.capability)) {
        throw new DaemonError(
          ErrorCodes.VALIDATION,
          `unknown capability ${sub.capability}`,
          400,
        );
      }
      return {
        id: `step-${index + 1}`,
        capability: sub.capability,
        description: sub.description,
        dependsOn: index === 0 ? [] : [`step-${index}`],
      };
    });
    return { goal, steps };
  }
}
