import type { OntologyScope } from "@daemon/context-ports";
import { PostgresClient } from "../operational-store/postgres-client.js";
import { withTenantSession } from "../operational-store/tenant-session.js";

export interface BronzeEntityTypeCountRow {
  entityType: string;
  count: number;
}

export interface BronzeChangeVolumeRow {
  day: string;
  changeType: string;
  count: number;
}

export interface BronzeLakehouseSummary {
  entityTypeCounts: BronzeEntityTypeCountRow[];
  changeVolumeByDay: BronzeChangeVolumeRow[];
  window: { since?: string };
}

/**
 * Read-only aggregations over {@link daemon_lakehouse_bronze}.
 */
export class BronzeReader {
  private constructor(private readonly pg: PostgresClient | null) {}

  static fromEnv(env: NodeJS.ProcessEnv = process.env): BronzeReader {
    const url = env.DAEMON_POSTGRES_URL;
    if (!url) return new BronzeReader(null);
    return new BronzeReader(new PostgresClient({ connectionString: url }));
  }

  enabled(): boolean {
    return this.pg !== null;
  }

  async summarize(
    scope: OntologyScope,
    options: { since?: string } = {},
  ): Promise<BronzeLakehouseSummary> {
    if (!this.pg) {
      return { entityTypeCounts: [], changeVolumeByDay: [], window: {} };
    }
    return withTenantSession(this.pg, scope.tenantId, async (client) => {
      const sinceClause = options.since
        ? ` AND indexed_at >= $3::timestamptz`
        : "";
      const baseParams: unknown[] = [scope.tenantId, scope.domainId];
      if (options.since) baseParams.push(options.since);

      const typeCounts = await client.query<{
        entity_type: string;
        cnt: string;
      }>(
        `SELECT COALESCE(entity_type, 'unknown') AS entity_type, COUNT(*)::bigint AS cnt
         FROM daemon_lakehouse_bronze
         WHERE tenant_id = $1 AND domain_id = $2${sinceClause}
         GROUP BY COALESCE(entity_type, 'unknown')
         ORDER BY cnt DESC`,
        baseParams,
      );

      const volume = await client.query<{
        day: Date;
        change_type: string;
        cnt: string;
      }>(
        `SELECT date_trunc('day', indexed_at) AS day, change_type, COUNT(*)::bigint AS cnt
         FROM daemon_lakehouse_bronze
         WHERE tenant_id = $1 AND domain_id = $2${sinceClause}
         GROUP BY date_trunc('day', indexed_at), change_type
         ORDER BY day DESC, change_type`,
        baseParams,
      );

      return {
        entityTypeCounts: typeCounts.rows.map((r) => ({
          entityType: r.entity_type,
          count: Number(r.cnt),
        })),
        changeVolumeByDay: volume.rows.map((r) => ({
          day: r.day.toISOString(),
          changeType: r.change_type,
          count: Number(r.cnt),
        })),
        window: options.since ? { since: options.since } : {},
      };
    });
  }
}
