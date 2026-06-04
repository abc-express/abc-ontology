import type { OntologyScope } from "@daemon/context-ports";
import { PostgresClient } from "../operational-store/postgres-client.js";
import { withTenantSession } from "../operational-store/tenant-session.js";

export interface GoldEntityCountRow {
  entityType: string;
  entityCount: number;
}

export interface GoldChangeVolumeRow {
  day: string;
  changeCount: number;
}

export interface LakehouseSummary {
  entityCounts: GoldEntityCountRow[];
  changeVolume: GoldChangeVolumeRow[];
}

/**
 * Read gold analytics views (entity counts, bronze change volume).
 */
export class LakehouseReader {
  private constructor(private readonly pg: PostgresClient | null) {}

  static fromEnv(env: NodeJS.ProcessEnv = process.env): LakehouseReader {
    const url = env.DAEMON_POSTGRES_URL;
    if (!url) return new LakehouseReader(null);
    return new LakehouseReader(new PostgresClient({ connectionString: url }));
  }

  enabled(): boolean {
    return this.pg !== null;
  }

  async summarize(scope: OntologyScope): Promise<LakehouseSummary> {
    const pg = this.pg;
    if (!pg) {
      return { entityCounts: [], changeVolume: [] };
    }
    return withTenantSession(pg, scope.tenantId, async (client) => {
      const counts = await client.query<{
        entity_type: string;
        entity_count: string;
      }>(
        `SELECT entity_type, entity_count
         FROM daemon_lakehouse_gold_entity_counts
         WHERE tenant_id = $1 AND domain_id = $2
         ORDER BY entity_count DESC`,
        [scope.tenantId, scope.domainId],
      );
      const volume = await client.query<{
        day: Date;
        change_count: string;
      }>(
        `SELECT day, change_count
         FROM daemon_lakehouse_gold_change_volume
         WHERE tenant_id = $1 AND domain_id = $2
         ORDER BY day DESC
         LIMIT 90`,
        [scope.tenantId, scope.domainId],
      );
      return {
        entityCounts: counts.rows.map((r) => ({
          entityType: r.entity_type,
          entityCount: Number(r.entity_count),
        })),
        changeVolume: volume.rows.map((r) => ({
          day: r.day.toISOString(),
          changeCount: Number(r.change_count),
        })),
      };
    });
  }
}
