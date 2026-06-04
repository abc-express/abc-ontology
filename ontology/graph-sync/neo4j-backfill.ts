import type { OntologyScope } from "@daemon/context-ports";
import { Neo4jGraphStore } from "@daemon/data-platform/graph-store/neo4j-graph-store";
import { PostgresEntityJournal } from "@daemon/data-platform/operational-store/entity-journal";
import { buildPackGraphSchema } from "../graph-schema/pack-graph-schema.js";
import { isAllowedEntityLabel } from "../graph-schema/pack-graph-schema.js";

export type Neo4jBackfillOptions = {
  scope: OntologyScope;
  dryRun?: boolean;
  batchSize?: number;
  onProgress?: (message: string) => void;
};

export type Neo4jBackfillResult = {
  entitiesProcessed: number;
  linksProcessed: number;
  dryRun: boolean;
};

/**
 * Idempotent backfill from Postgres journal tables into Neo4j.
 */
export async function runNeo4jBackfill(
  journal: PostgresEntityJournal,
  store: Neo4jGraphStore,
  options: Neo4jBackfillOptions,
): Promise<Neo4jBackfillResult> {
  const batchSize = options.batchSize ?? 200;
  const schema = buildPackGraphSchema();
  if (!options.dryRun) {
    await store.ensureSchema(schema.constraintStatements);
  }

  const records = await journal.loadScope(options.scope);
  let entitiesProcessed = 0;
  let linksProcessed = 0;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    for (const record of batch) {
      entitiesProcessed += 1;
      if (record.entityType === "Link") linksProcessed += 1;
      if (options.dryRun) continue;
      const typeLabel =
        record.entityType && isAllowedEntityLabel(record.entityType)
          ? record.entityType
          : null;
      await store.upsertEntity(record, { typeLabel });
      if (record.entityType === "Link") {
        await store.upsertLink(record);
      }
    }
    options.onProgress?.(
      `processed ${Math.min(i + batch.length, records.length)}/${records.length} snapshots`,
    );
  }

  return {
    entitiesProcessed,
    linksProcessed,
    dryRun: Boolean(options.dryRun),
  };
}
