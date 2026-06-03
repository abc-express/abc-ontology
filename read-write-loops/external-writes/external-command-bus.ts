/** Spec: read-write-loops/external-writes/external-command-bus.ts */
export interface ExternalCommand {
  target: string;
  payload: Record<string, unknown>;
}

export class ExternalCommandBus {
  private readonly queue: ExternalCommand[] = [];

  publish(cmd: ExternalCommand): void {
    if (!cmd.target) throw new Error("target required");
    this.queue.push(cmd);
  }

  drain(): ExternalCommand[] {
    const out = [...this.queue];
    this.queue.length = 0;
    return out;
  }
}
