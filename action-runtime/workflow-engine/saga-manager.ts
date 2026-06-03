/** Spec: action-runtime/workflow-engine/saga-manager.ts */
export class SagaManager {
  private readonly active = new Set<string>();

  begin(sagaId: string): void {
    if (this.active.has(sagaId)) throw new Error(`saga already active: ${sagaId}`);
    this.active.add(sagaId);
  }

  complete(sagaId: string): void {
    this.active.delete(sagaId);
  }

  isActive(sagaId: string): boolean {
    return this.active.has(sagaId);
  }
}
