import type { OntologyId } from "@daemon/platform-types";
import { globalRegistry } from "@daemon/ontology";
import type { ProductRuntime } from "../shared/product-runtime.js";

export type DashboardWidgetType = "entity-count" | "property-breakdown";

export interface DashboardWidget {
  id: string;
  type: DashboardWidgetType;
  title: string;
  data: Record<string, unknown>;
}

export interface DashboardBuildOptions {
  /** Property key to aggregate (default `status`). */
  breakdownField?: string;
}

export interface DashboardSpec {
  ontologyId: OntologyId;
  widgets: DashboardWidget[];
  builtAt: string;
}

/**
 * Composes a dashboard layout from live registry statistics (no external BI store).
 */
export class DashboardBuilder {
  constructor(private readonly runtime: ProductRuntime) {}

  build(ontologyId: OntologyId, options?: DashboardBuildOptions): DashboardSpec {
    this.runtime.assertAllowed("query", "analytics");
    const records = globalRegistry.list(ontologyId);
    const breakdownField = options?.breakdownField ?? "status";
    const breakdownCounts: Record<string, number> = {};
    const versionCounts: Record<string, number> = {};
    for (const record of records) {
      const bucket = String(record.properties[breakdownField] ?? "unknown");
      breakdownCounts[bucket] = (breakdownCounts[bucket] ?? 0) + 1;
      const ver = String(record.version);
      versionCounts[ver] = (versionCounts[ver] ?? 0) + 1;
    }
    const recentEntityIds = records
      .slice(-5)
      .map((r) => r.entityId)
      .reverse();
    return {
      ontologyId,
      builtAt: new Date().toISOString(),
      widgets: [
        {
          id: "entity-count",
          type: "entity-count",
          title: "Entities",
          data: { total: records.length },
        },
        {
          id: "property-breakdown",
          type: "property-breakdown",
          title: `${breakdownField} breakdown`,
          data: { field: breakdownField, counts: breakdownCounts },
        },
        {
          id: "version-breakdown",
          type: "property-breakdown",
          title: "Version distribution",
          data: { field: "version", counts: versionCounts },
        },
        {
          id: "recent-entities",
          type: "entity-count",
          title: "Recent entities",
          data: { entityIds: recentEntityIds },
        },
      ],
    };
  }
}
