import type { EntityRecord, OntologyScope } from "@daemon/context-ports";
import { PostgresClient } from "./postgres-client.js";
import { withTenantSession } from "./tenant-session.js";

export interface EntityJournal {
  upsert(record: EntityRecord): Promise<void>;
  recordChange(input: OntologyChangeInput): Promise<void>;
  upsertGraphEdge(input: GraphEdgeInput): Promise<void>;
  loadAll(): Promise<EntityRecord[]>;
  loadScope(scope: OntologyScope): Promise<EntityRecord[]>;
  listPage?(input: EntityListPageInput): Promise<EntityListPageResult>;
  close(): Promise<void>;
}

export interface OntologyChangeInput {
  scope: OntologyScope;
  ontologyId: string;
  entityId: string;
  changeType: "register" | "patch";
  payload: Record<string, unknown>;
  packVersion?: string;
}

export interface GraphEdgeInput {
  scope: OntologyScope;
  fromId: string;
  toId: string;
  relation: string;
}

export interface EntityListPageInput {
  scope: OntologyScope;
  ontologyId: string;
  entityType?: string;
  updatedAfter?: string;
  limit: number;
  cursor?: string;
}

export interface EntityListPageResult {
  items: EntityRecord[];
  nextCursor: string | null;
}

/** Postgres snapshot journal for durable entity state. */
export class PostgresEntityJournal implements EntityJournal {
  constructor(private readonly pg: PostgresClient) {}

  static fromEnv(
    env: NodeJS.ProcessEnv = process.env,
  ): PostgresEntityJournal | null {
    const url = env.DAEMON_POSTGRES_URL;
    if (!url) return null;
    return new PostgresEntityJournal(
      new PostgresClient({ connectionString: url }),
    );
  }

  async ensureSchema(): Promise<void> {
    await this.pg.query(`
      CREATE TABLE IF NOT EXISTS daemon_entity_snapshots (
        tenant_id TEXT NOT NULL,
        domain_id TEXT NOT NULL,
        ontology_id TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        entity_type TEXT,
        properties JSONB NOT NULL DEFAULT '{}',
        version INT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (tenant_id, domain_id, ontology_id, entity_id)
      )
    `);
    await this.pg.query(`
      CREATE TABLE IF NOT EXISTS daemon_ontology_changes (
        id BIGSERIAL PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        domain_id TEXT NOT NULL,
        ontology_id TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        change_type TEXT NOT NULL,
        payload JSONB NOT NULL DEFAULT '{}',
        pack_version TEXT,
        at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.pg.query(`
      CREATE TABLE IF NOT EXISTS daemon_graph_edges (
        id SERIAL PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        domain_id TEXT NOT NULL,
        from_id TEXT NOT NULL,
        to_id TEXT NOT NULL,
        relation TEXT NOT NULL
      )
    `);
  }

  async upsert(record: EntityRecord): Promise<void> {
    await this.ensureSchema();
    await withTenantSession(this.pg, record.tenantId, async (client) => {
      await client.query(
        `INSERT INTO daemon_entity_snapshots (
           tenant_id, domain_id, ontology_id, entity_id, entity_type,
           properties, version, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::timestamptz)
         ON CONFLICT (tenant_id, domain_id, ontology_id, entity_id)
         DO UPDATE SET
           entity_type = EXCLUDED.entity_type,
           properties = EXCLUDED.properties,
           version = EXCLUDED.version,
           updated_at = EXCLUDED.updated_at`,
        [
          record.tenantId,
          record.domainId,
          record.ontologyId,
          record.entityId,
          record.entityType ?? null,
          JSON.stringify(record.properties),
          record.version,
          record.updatedAt,
        ],
      );
    });
  }

  async recordChange(input: OntologyChangeInput): Promise<void> {
    await this.ensureSchema();
    await withTenantSession(this.pg, input.scope.tenantId, async (client) => {
      await client.query(
        `INSERT INTO daemon_ontology_changes (
           tenant_id, domain_id, ontology_id, entity_id,
           change_type, payload, pack_version
         ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
        [
          input.scope.tenantId,
          input.scope.domainId,
          input.ontologyId,
          input.entityId,
          input.changeType,
          JSON.stringify(input.payload),
          input.packVersion ?? null,
        ],
      );
    });
  }

  async upsertGraphEdge(input: GraphEdgeInput): Promise<void> {
    await this.ensureSchema();
    await withTenantSession(this.pg, input.scope.tenantId, async (client) => {
      await client.query(
        `INSERT INTO daemon_graph_edges (tenant_id, domain_id, from_id, to_id, relation)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (tenant_id, domain_id, from_id, to_id, relation) DO NOTHING`,
        [
          input.scope.tenantId,
          input.scope.domainId,
          input.fromId,
          input.toId,
          input.relation,
        ],
      );
    });
  }

  async loadAll(): Promise<EntityRecord[]> {
    await this.ensureSchema();
    const result = await this.pg.query<{
      tenant_id: string;
      domain_id: string;
      ontology_id: string;
      entity_id: string;
      entity_type: string | null;
      properties: Record<string, unknown>;
      version: number;
      updated_at: Date;
    }>(`SELECT * FROM daemon_load_entity_snapshots()`);
    return result.rows.map(rowToRecord);
  }

  async loadScope(scope: OntologyScope): Promise<EntityRecord[]> {
    await this.ensureSchema();
    return withTenantSession(this.pg, scope.tenantId, async (client) => {
      const result = await client.query<{
        tenant_id: string;
        domain_id: string;
        ontology_id: string;
        entity_id: string;
        entity_type: string | null;
        properties: Record<string, unknown>;
        version: number;
        updated_at: Date;
      }>(
        `SELECT tenant_id, domain_id, ontology_id, entity_id, entity_type,
                properties, version, updated_at
         FROM daemon_entity_snapshots
         WHERE tenant_id = $1 AND domain_id = $2
         ORDER BY updated_at ASC, entity_id ASC`,
        [scope.tenantId, scope.domainId],
      );
      return result.rows.map(rowToRecord);
    });
  }

  async listPage(input: EntityListPageInput): Promise<EntityListPageResult> {
    await this.ensureSchema();
    const limit = Math.min(Math.max(input.limit, 1), 200);
    return withTenantSession(this.pg, input.scope.tenantId, async (client) => {
      const params: unknown[] = [
        input.scope.tenantId,
        input.scope.domainId,
        input.ontologyId,
      ];
      const filters: string[] = [
        "tenant_id = $1",
        "domain_id = $2",
        "ontology_id = $3",
      ];
      if (input.entityType) {
        params.push(input.entityType);
        filters.push(`entity_type = $${params.length}`);
      }
      if (input.updatedAfter) {
        params.push(input.updatedAfter);
        filters.push(`updated_at >= $${params.length}::timestamptz`);
      }
      if (input.cursor) {
        params.push(input.cursor);
        filters.push(`entity_id > $${params.length}`);
      }
      params.push(limit + 1);
      const result = await client.query<{
        tenant_id: string;
        domain_id: string;
        ontology_id: string;
        entity_id: string;
        entity_type: string | null;
        properties: Record<string, unknown>;
        version: number;
        updated_at: Date;
      }>(
        `SELECT tenant_id, domain_id, ontology_id, entity_id, entity_type,
                properties, version, updated_at
         FROM daemon_entity_snapshots
         WHERE ${filters.join(" AND ")}
         ORDER BY entity_id ASC
         LIMIT $${params.length}`,
        params,
      );
      const rows = result.rows.map(rowToRecord);
      let nextCursor: string | null = null;
      let items = rows;
      if (rows.length > limit) {
        items = rows.slice(0, limit);
        nextCursor = items[items.length - 1]?.entityId ?? null;
      }
      return { items, nextCursor };
    });
  }

  async close(): Promise<void> {
    await this.pg.close();
  }
}

function rowToRecord(row: {
  tenant_id: string;
  domain_id: string;
  ontology_id: string;
  entity_id: string;
  entity_type: string | null;
  properties: Record<string, unknown>;
  version: number;
  updated_at: Date;
}): EntityRecord {
  return {
    tenantId: row.tenant_id,
    domainId: row.domain_id,
    ontologyId: row.ontology_id as EntityRecord["ontologyId"],
    entityId: row.entity_id as EntityRecord["entityId"],
    entityType: row.entity_type ?? undefined,
    properties: row.properties ?? {},
    version: row.version,
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at),
  };
}
