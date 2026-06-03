/** Spec: collect-sensing/pipelines/replay-pipeline.ts */
export class ReplayPipeline {
  async replay<T>(events: T[], handler: (event: T, index: number) => Promise<void>): Promise<void> {
    for (let i = 0; i < events.length; i++) await handler(events[i]!, i);
  }
}
