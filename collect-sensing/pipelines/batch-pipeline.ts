/** Spec: collect-sensing/pipelines/batch-pipeline.ts */
export class BatchPipeline {
  async process<T>(items: T[], handler: (item: T) => Promise<void>): Promise<number> {
    let n = 0;
    for (const item of items) { await handler(item); n++; }
    return n;
  }
}
