import type { EntityRecord, OntologyScope } from "@daemon/context-ports";
export type BronzeChangeType = "register" | "patch";
import { PostgresClient } from "../operational-store/postgres-client.js";
import { withTenantSession } from "../operational-store/tenant-session.js";

export interface BronzeEventRow {
  id: string;
  tenantId: string;
  domainId: string;
  ontologyId: string;
  entityId: string;
  entityType: string | null;
  changeType: BronzeChangeType;
  payload: Record<string, unknown>;
  source: string | null;
  indexedAt: string;
}

export class BronzeWriter {
  private constructor(private readonly pg: PostgresClient | null) {}

  static fromEnv(env: NodeJS.ProcessEnv = process.env): BronzeWriter {
    const url = env.DAEMON_POSTGRES_URL;
    if (!url) return new BronzeWriter(null);
    return new BronzeWriter(new PostgresClient({ connectionString: url }));
  }

  async append(
    scope: OntologyScope,
    record: EntityRecord,
    trigger: BronzeChangeType,
    source = "propagation",
  ): Promise<void> {
    if (!this.pg) return;
    await withTenantSession(this.pg, scope.tenantId, async (client) => {
      await client.query(
        `INSERT INTO daemon_lakehouse_bronze
          (tenant_id, domain_id, ontology_id, entity_id, entity_type, change_type, payload, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
        [
          scope.tenantId,
          scope.domainId,
          record.ontologyId,
          record.entityId,
          record.entityType ?? null,
          trigger,
          JSON.stringify({
            properties: record.properties,
            version: record.version,
            updatedAt: record.updatedAt,
          }),
          source,
        ],
      );
    });
  }

  async listEvents(
    scope: OntologyScope,
    options: {
      since?: string;
      limit?: number;
      entityType?: string;
      ontologyId?: string;
      changeType?: BronzeChangeType;
    } = {},
  ): Promise<BronzeEventRow[]> {
    if (!this.pg) return [];
    const limit = Math.min(options.limit ?? 100, 500);
    return withTenantSession(this.pg, scope.tenantId, async (client) => {
      const params: unknown[] = [scope.tenantId, scope.domainId];
      let sql = `SELECT id::text, tenant_id, domain_id, ontology_id, entity_id, entity_type,
                        change_type, payload, source, indexed_at
                 FROM daemon_lakehouse_bronze
                 WHERE tenant_id = $1 AND domain_id = $2`;
      if (options.since) {
        params.push(options.since);
        sql += ` AND indexed_at >= $${params.length}::timestamptz`;
      }
      if (options.entityType) {
        params.push(options.entityType);
        sql += ` AND entity_type = $${params.length}`;
      }
      if (options.ontologyId) {
        params.push(options.ontologyId);
        sql += ` AND ontology_id = $${params.length}`;
      }
      if (options.changeType) {
        params.push(options.changeType);
        sql += ` AND change_type = $${params.length}`;
      }
      params.push(limit);
      sql += ` ORDER BY indexed_at DESC LIMIT $${params.length}`;
      const result = await client.query<{
        id: string;
        tenant_id: string;
        domain_id: string;
        ontology_id: string;
        entity_id: string;
        entity_type: string | null;
        change_type: BronzeChangeType;
        payload: Record<string, unknown>;
        source: string | null;
        indexed_at: Date;
      }>(sql, params);
      return result.rows.map((row) => ({
        id: row.id,
        tenantId: row.tenant_id,
        domainId: row.domain_id,
        ontologyId: row.ontology_id,
        entityId: row.entity_id,
        entityType: row.entity_type,
        changeType: row.change_type,
        payload: row.payload,
        source: row.source,
        indexedAt: row.indexed_at.toISOString(),
      }));
    });
  }
}
