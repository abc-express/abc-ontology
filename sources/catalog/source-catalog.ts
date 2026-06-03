/** Spec: sources — connector manifests and validation. */
export type SourceManifest = {
  id: string;
  type: "api" | "db" | "stream" | "file";
  ontologyId: string;
  config: Record<string, unknown>;
};

export class SourceCatalog {
  private readonly sources = new Map<string, SourceManifest>();

  register(manifest: SourceManifest): void {
    if (!manifest.id || !manifest.ontologyId) {
      throw new Error("source manifest requires id and ontologyId");
    }
    this.sources.set(manifest.id, manifest);
  }

  get(id: string): SourceManifest | undefined {
    return this.sources.get(id);
  }

  validate(manifest: SourceManifest): string[] {
    const errors: string[] = [];
    if (!manifest.id) errors.push("missing id");
    if (!manifest.ontologyId) errors.push("missing ontologyId");
    if (!manifest.type) errors.push("missing type");
    return errors;
  }

  list(): SourceManifest[] {
    return [...this.sources.values()];
  }
}
