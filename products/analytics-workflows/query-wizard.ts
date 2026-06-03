import type { OntologyId } from "@daemon/platform-types";
import { defaultOntology, globalRegistry, type EntityRecord } from "@daemon/ontology";
import type { ProductRuntime } from "../shared/product-runtime.js";

export interface QueryWizardRequest {
  query: string;
  ontologyId?: OntologyId;
  limit?: number;
  /** When set, only entities with this property key are considered. */
  property?: string;
  /** Exact match on `property` (string/number/boolean coerced to string). */
  propertyValue?: string;
}

/**
 * Simple ontology-backed search for analytics workflows. Matches query text
 * against serialized entity properties (case-insensitive substring).
 */
export class QueryWizard {
  constructor(private readonly runtime: ProductRuntime) {}

  search(req: QueryWizardRequest): EntityRecord[] {
    this.runtime.assertAllowed("query", "analytics");
    const ont = req.ontologyId ?? defaultOntology();
    const needle = req.query.trim().toLowerCase();
    if (!needle) {
      return [];
    }
    const limit = req.limit ?? 50;
    const hits = globalRegistry.list(ont).filter((record) => {
      if (req.property) {
        if (!(req.property in record.properties)) {
          return false;
        }
        if (req.propertyValue !== undefined) {
          const actual = String(record.properties[req.property]);
          if (actual !== req.propertyValue) {
            return false;
          }
        }
      }
      const hay = JSON.stringify(record.properties).toLowerCase();
      return hay.includes(needle);
    });
    return hits.slice(0, limit);
  }
}
