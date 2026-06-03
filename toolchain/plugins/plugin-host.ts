/** Spec: toolchain/plugins — plugin manifest and loader. */
export type PluginManifest = {
  id: string;
  version: string;
  entityTypes?: string[];
};

export type PluginContext = {
  registerEntityType(name: string): void;
};

export interface DaemonPlugin {
  readonly manifest: PluginManifest;
  activate(ctx: PluginContext): void;
}

export class PluginHost {
  private readonly plugins = new Map<string, DaemonPlugin>();
  private readonly entityTypes = new Set<string>();

  register(plugin: DaemonPlugin): void {
    this.plugins.set(plugin.manifest.id, plugin);
    plugin.activate({
      registerEntityType: (name) => this.entityTypes.add(name),
    });
  }

  list(): PluginManifest[] {
    return [...this.plugins.values()].map((p) => p.manifest);
  }

  entityTypesRegistered(): string[] {
    return [...this.entityTypes];
  }
}
