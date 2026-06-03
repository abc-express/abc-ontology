import { DaemonError, ErrorCodes } from "@daemon/platform-types";

export interface PlanAction {
  name: string;
  requires: string[];
  produces: string[];
}

/**
 * Goal-regression planner. Given available facts and a goal, orders actions so
 * each action's preconditions are satisfied before it runs. Throws when the
 * goal is unreachable from the available facts.
 */
export class Planner {
  constructor(private readonly actions: PlanAction[]) {}

  plan(available: string[], goal: string): PlanAction[] {
    const state = new Set(available);
    const ordered: PlanAction[] = [];
    const remaining = [...this.actions];

    let progress = true;
    while (!state.has(goal) && progress) {
      progress = false;
      for (let i = 0; i < remaining.length; i++) {
        const action = remaining[i];
        if (action.requires.every((r) => state.has(r))) {
          ordered.push(action);
          for (const p of action.produces) state.add(p);
          remaining.splice(i, 1);
          progress = true;
          break;
        }
      }
    }

    if (!state.has(goal)) {
      throw new DaemonError(
        ErrorCodes.VALIDATION,
        `goal "${goal}" is unreachable from available facts`,
        400,
      );
    }
    return ordered;
  }
}
