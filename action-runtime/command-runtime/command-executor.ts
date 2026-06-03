/** Spec: action-runtime/command-runtime/command-executor.ts */
export interface CommandRequest {
  name: string;
  payload: Record<string, unknown>;
}

export class CommandExecutor {
  execute(req: CommandRequest): { accepted: boolean; name: string } {
    if (!req.name?.trim()) throw new Error("command name required");
    return { accepted: true, name: req.name };
  }
}
