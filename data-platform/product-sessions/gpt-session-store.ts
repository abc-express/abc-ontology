import type { OntologyScope } from "@daemon/context-ports";
import { PostgresClient } from "../operational-store/postgres-client.js";
import { withTenantSession } from "../operational-store/tenant-session.js";

export class GptSessionStore {
  private constructor(private readonly pg: PostgresClient) {}

  static fromEnv(env: NodeJS.ProcessEnv = process.env): GptSessionStore | null {
    const url = env.DAEMON_POSTGRES_URL;
    if (!url) return null;
    return new GptSessionStore(new PostgresClient({ connectionString: url }));
  }

  async getCitations(
    scope: OntologyScope,
    sessionId: string,
  ): Promise<string[]> {
    return withTenantSession(this.pg, scope.tenantId, async (client) => {
      const result = await client.query<{ citations: string[] }>(
        `SELECT citations FROM daemon_gpt_sessions
         WHERE tenant_id = $1 AND domain_id = $2 AND session_id = $3`,
        [scope.tenantId, scope.domainId, sessionId],
      );
      const row = result.rows[0];
      if (!row?.citations || !Array.isArray(row.citations)) return [];
      return row.citations.map(String);
    });
  }

  async upsertCitations(
    scope: OntologyScope,
    sessionId: string,
    citations: string[],
  ): Promise<void> {
    await withTenantSession(this.pg, scope.tenantId, async (client) => {
      await client.query(
        `INSERT INTO daemon_gpt_sessions (tenant_id, domain_id, session_id, citations, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, NOW())
         ON CONFLICT (tenant_id, domain_id, session_id)
         DO UPDATE SET citations = EXCLUDED.citations, updated_at = NOW()`,
        [
          scope.tenantId,
          scope.domainId,
          sessionId,
          JSON.stringify(citations),
        ],
      );
    });
  }
}
