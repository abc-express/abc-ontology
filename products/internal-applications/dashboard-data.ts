import type { OntologyId } from "@daemon/platform-types";
import { globalRegistry } from "@daemon/ontology";
import type { ProductRuntime } from "../shared/product-runtime.js";

export interface OpsMetric {
  name: string;
  value: number;
}

export interface InternalDashboardSnapshot {
  ontologyId: OntologyId;
  metrics: OpsMetric[];
  recentEntityIds: string[];
  capturedAt: string;
}

/**
 * Internal ops/risk dashboard feed derived from the ontology registry.
 */
export class DashboardDataService {
  constructor(private readonly runtime: ProductRuntime) {}

  snapshot(ontologyId: OntologyId): InternalDashboardSnapshot {
    this.runtime.assertAllowed("read", "entity");
    const records = globalRegistry.list(ontologyId);
    const active = records.filter((r) => r.properties.status === "active").length;
    const pending = records.filter((r) => r.properties.status === "pending").length;
    return {
      ontologyId,
      metrics: [
        { name: "entities_total", value: records.length },
        { name: "entities_active", value: active },
        { name: "entities_pending", value: pending },
      ],
      recentEntityIds: records
        .slice()
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 10)
        .map((r) => r.entityId),
      capturedAt: new Date().toISOString(),
    };
  }
}
