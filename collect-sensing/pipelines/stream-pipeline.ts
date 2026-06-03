/** Spec: collect-sensing/pipelines/stream-pipeline.ts */
export class StreamPipeline<T> {
  private readonly handlers: Array<(item: T) => Promise<void>> = [];
  on(handler: (item: T) => Promise<void>): void { this.handlers.push(handler); }
  async emit(item: T): Promise<void> { await Promise.all(this.handlers.map((h) => h(item))); }
}
