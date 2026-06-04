import type { EntityRecord, OntologyScope } from "@daemon/context-ports";
import type { Neo4jGraphStore } from "@daemon/data-platform/graph-store/neo4j-graph-store";
import { isAllowedEntityLabel } from "../graph-schema/pack-graph-schema.js";

/**
 * Propagation target: upserts entity nodes and LINK relationships into Neo4j.
 */
export class Neo4jGraphSync {
  constructor(private readonly store: Neo4jGraphStore) {}

  sync(record: EntityRecord, _scope: OntologyScope): void {
    const typeLabel =
      record.entityType && isAllowedEntityLabel(record.entityType)
        ? record.entityType
        : null;
    void this.store
      .upsertEntity(record, { typeLabel })
      .then(async () => {
        if (record.entityType === "Link") {
          await this.store.upsertLink(record);
        }
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`neo4j-graph-sync failed: ${message}`);
      });
  }
}
