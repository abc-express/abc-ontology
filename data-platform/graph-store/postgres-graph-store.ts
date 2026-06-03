import { PostgresClient } from "../operational-store/postgres-client.js";

export type GraphEdge = {
  fromId: string;
  toId: string;
  relation: string;
};

/** Adjacency table backed by Postgres for integration paths. */
export class PostgresGraphStore {
  constructor(private readonly pg: PostgresClient) {}

  static fromEnv(env: NodeJS.ProcessEnv = process.env): PostgresGraphStore | null {
    const url = env.DAEMON_POSTGRES_URL;
    if (!url) return null;
    return new PostgresGraphStore(new PostgresClient({ connectionString: url }));
  }

  async ensureSchema(): Promise<void> {
    await this.pg.query(`
      CREATE TABLE IF NOT EXISTS daemon_graph_edges (
        id SERIAL PRIMARY KEY,
        from_id TEXT NOT NULL,
        to_id TEXT NOT NULL,
        relation TEXT NOT NULL,
        UNIQUE (from_id, to_id, relation)
      )
    `);
  }

  async addEdge(edge: GraphEdge): Promise<void> {
    await this.ensureSchema();
    await this.pg.query(
      `INSERT INTO daemon_graph_edges (from_id, to_id, relation)
       VALUES ($1, $2, $3)
       ON CONFLICT (from_id, to_id, relation) DO NOTHING`,
      [edge.fromId, edge.toId, edge.relation],
    );
  }

  async neighbors(fromId: string): Promise<GraphEdge[]> {
    await this.ensureSchema();
    const result = await this.pg.query<{
      from_id: string;
      to_id: string;
      relation: string;
    }>(
      `SELECT from_id, to_id, relation FROM daemon_graph_edges WHERE from_id = $1`,
      [fromId],
    );
    return result.rows.map((row) => ({
      fromId: row.from_id,
      toId: row.to_id,
      relation: row.relation,
    }));
  }

  async close(): Promise<void> {
    await this.pg.close();
  }
}
