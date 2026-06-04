import type { EntityJournal } from "@daemon/data-platform/operational-store/entity-journal";
import type { ScopedOntologySearch } from "./scoped-ontology-search.js";

/**
 * Rebuild in-memory hybrid search indexes from the durable entity journal.
 * Does not re-run propagation (avoids duplicate bronze/silver rows).
 */
export async function replaySearchIndex(
  search: ScopedOntologySearch,
  journal: EntityJournal,
): Promise<number> {
  const rows = await journal.loadAll();
  for (const record of rows) {
    await search.indexAsync(record, {
      tenantId: record.tenantId,
      domainId: record.domainId,
    });
  }
  return rows.length;
}
