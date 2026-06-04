import type { EntityRecord, OntologyScope } from "@daemon/context-ports";
import { PostgresClient } from "../operational-store/postgres-client.js";
import { withTenantSession } from "../operational-store/tenant-session.js";

/**
 * Curated latest entity state (upsert per entity). Postgres only.
 */
export class SilverWriter {
  private constructor(private readonly pg: PostgresClient | null) {}

  static fromEnv(env: NodeJS.ProcessEnv = process.env): SilverWriter {
    const url = env.DAEMON_POSTGRES_URL;
    if (!url) return new SilverWriter(null);
    return new SilverWriter(new PostgresClient({ connectionString: url }));
  }

  enabled(): boolean {
    return this.pg !== null;
  }

  async upsert(scope: OntologyScope, record: EntityRecord): Promise<void> {
    if (!this.pg) return;
    await withTenantSession(this.pg, scope.tenantId, async (client) => {
      await client.query(
        `INSERT INTO daemon_lakehouse_silver_entity (
           tenant_id, domain_id, ontology_id, entity_id,
           entity_type, properties, version, source_updated_at, materialized_at
         ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::timestamptz, NOW())
         ON CONFLICT (tenant_id, domain_id, ontology_id, entity_id)
         DO UPDATE SET
           entity_type = EXCLUDED.entity_type,
           properties = EXCLUDED.properties,
           version = EXCLUDED.version,
           source_updated_at = EXCLUDED.source_updated_at,
           materialized_at = NOW()`,
        [
          scope.tenantId,
          scope.domainId,
          record.ontologyId,
          record.entityId,
          record.entityType ?? null,
          JSON.stringify(record.properties ?? {}),
          record.version ?? 1,
          record.updatedAt ?? null,
        ],
      );
    });
  }
}
