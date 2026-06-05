import type { TestContext } from "node:test";
import { Neo4jGraphStore } from "@daemon/data-platform/graph-store/neo4j-graph-store";

/**
 * Skip when Neo4j is not configured or not accepting connections.
 */
export async function skipUnlessNeo4jReady(
  t: Pick<TestContext, "skip">,
): Promise<Neo4jGraphStore | undefined> {
  const uri = process.env.DAEMON_NEO4J_URI?.trim();
  const user = process.env.DAEMON_NEO4J_USER?.trim();
  const password = process.env.DAEMON_NEO4J_PASSWORD?.trim();
  if (!uri || !user || !password) {
    t.skip(
      "Neo4j not configured — set DAEMON_NEO4J_URI, DAEMON_NEO4J_USER, DAEMON_NEO4J_PASSWORD",
    );
    return undefined;
  }
  const store = new Neo4jGraphStore({ uri, user, password });
  try {
    const ok = await store.ping();
    if (!ok) {
      t.skip(`Neo4j not reachable (${uri})`);
      return undefined;
    }
  } catch {
    t.skip("Neo4j not reachable — run `pnpm run dev:up`");
    return undefined;
  }
  return store;
}
