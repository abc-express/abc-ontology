/** Postgres-backed audit log for integration and e2e paths. */
import { PostgresClient } from "@daemon/data-platform/operational-store";
import type { AuditEntry } from "./audit-log.js";

export class PostgresAuditLog {
  constructor(private readonly pg: PostgresClient) {}

  static fromEnv(env: NodeJS.ProcessEnv = process.env): PostgresAuditLog | null {
    const url = env.DAEMON_POSTGRES_URL;
    if (!url) return null;
    return new PostgresAuditLog(new PostgresClient({ connectionString: url }));
  }

  async ensureSchema(): Promise<void> {
    await this.pg.query(`
      CREATE TABLE IF NOT EXISTS daemon_audit (
        id SERIAL PRIMARY KEY,
        at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        action TEXT NOT NULL,
        subject_id TEXT NOT NULL,
        resource TEXT NOT NULL,
        outcome TEXT NOT NULL CHECK (outcome IN ('allow', 'deny'))
      )
    `);
  }

  async append(entry: Omit<AuditEntry, "id" | "at">): Promise<AuditEntry> {
    await this.ensureSchema();
    const result = await this.pg.query<{ id: number; at: Date }>(
      `INSERT INTO daemon_audit (action, subject_id, resource, outcome)
       VALUES ($1, $2, $3, $4)
       RETURNING id, at`,
      [entry.action, entry.subjectId, entry.resource, entry.outcome],
    );
    const row = result.rows[0];
    if (!row) throw new Error("audit insert returned no row");
    return {
      id: `audit-${row.id}`,
      at: row.at.toISOString(),
      ...entry,
    };
  }

  async list(limit = 100): Promise<AuditEntry[]> {
    await this.ensureSchema();
    const result = await this.pg.query<{
      id: number;
      at: Date;
      action: string;
      subject_id: string;
      resource: string;
      outcome: "allow" | "deny";
    }>(
      `SELECT id, at, action, subject_id, resource, outcome
       FROM daemon_audit ORDER BY id DESC LIMIT $1`,
      [limit],
    );
    return result.rows.map((row) => ({
      id: `audit-${row.id}`,
      at: row.at.toISOString(),
      action: row.action,
      subjectId: row.subject_id,
      resource: row.resource,
      outcome: row.outcome,
    }));
  }

  async close(): Promise<void> {
    await this.pg.close();
  }
}
