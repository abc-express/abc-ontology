import type { Neo4jGraphStore } from "@daemon/data-platform/graph-store/neo4j-graph-store";
import type { OntologyQueryStateType } from "../state.js";

export async function executeCypherNode(
  state: OntologyQueryStateType,
  store: Neo4jGraphStore,
): Promise<Partial<OntologyQueryStateType>> {
  if (state.error || !state.cypher) return {};
  try {
    const rawResult = await store.runReadQuery(
      state.cypher,
      state.cypherParams ?? {},
    );
    return { rawResult, error: undefined };
  } catch (err) {
    return {
      rawResult: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
