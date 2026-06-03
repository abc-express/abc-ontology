import type { DaemonPlugin, PluginManifest } from "../plugin-host.js";

export const referencePluginManifest: PluginManifest = {
  id: "reference-validator",
  version: "0.1.0",
  entityTypes: ["ReferenceAsset"],
};

export const referencePlugin: DaemonPlugin = {
  manifest: referencePluginManifest,
  activate(ctx) {
    for (const type of referencePluginManifest.entityTypes ?? []) {
      ctx.registerEntityType(type);
    }
  },
};
