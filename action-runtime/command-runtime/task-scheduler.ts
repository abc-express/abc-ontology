/** Spec: action-runtime/command-runtime/task-scheduler.ts */
import { DaemonError, ErrorCodes } from "@daemon/platform-types";

export interface ScheduledTask {
  id: string;
  dependsOn: string[];
}

/**
 * Resolves a runnable order for tasks with explicit dependencies via a
 * deterministic topological sort. Detects missing dependencies and cycles so an
 * unsatisfiable schedule fails loudly instead of deadlocking the runtime.
 */
export class TaskScheduler {
  /** Return task ids in an order where every dependency precedes its dependents. */
  order(tasks: ScheduledTask[]): string[] {
    const byId = new Map(tasks.map((t) => [t.id, t]));
    for (const task of tasks) {
      for (const dep of task.dependsOn) {
        if (!byId.has(dep)) {
          throw new DaemonError(
            ErrorCodes.VALIDATION,
            `task ${task.id} depends on unknown ${dep}`,
            400,
          );
        }
      }
    }

    const result: string[] = [];
    const state = new Map<string, "visiting" | "done">();

    const visit = (id: string): void => {
      const status = state.get(id);
      if (status === "done") return;
      if (status === "visiting") {
        throw new DaemonError(ErrorCodes.CONFLICT, `dependency cycle at ${id}`, 409);
      }
      state.set(id, "visiting");
      // Sort deps for deterministic output across equivalent graphs.
      for (const dep of [...byId.get(id)!.dependsOn].sort()) {
        visit(dep);
      }
      state.set(id, "done");
      result.push(id);
    };

    for (const task of [...tasks].sort((a, b) => a.id.localeCompare(b.id))) {
      visit(task.id);
    }
    return result;
  }
}
