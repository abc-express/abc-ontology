/** Spec: collect-sensing/orchestrator/source-registry.ts */
export interface SourceRecord { id: string; type: string; config: Record<string, unknown>; }
export class SourceRegistryClient {
  private readonly sources = new Map<string, SourceRecord>();
  register(source: SourceRecord): void { this.sources.set(source.id, source); }
  get(id: string): SourceRecord | undefined { return this.sources.get(id); }
  list(): SourceRecord[] { return [...this.sources.values()]; }
}
