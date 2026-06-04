import neo4j, { type Driver } from "neo4j-driver";
import type { EntityRecord } from "@daemon/context-ports";

export type Neo4jGraphStoreConfig = {
  uri: string;
  user: string;
  password: string;
  database?: string;
  maxRows?: number;
  queryTimeoutMs?: number;
};

export type ReadQueryOptions = {
  maxRows?: number;
  timeoutMs?: number;
};

const DEFAULT_MAX_ROWS = 100;
const DEFAULT_TIMEOUT_MS = 5_000;

function sanitizeTypeLabel(entityType: string | undefined): string | null {
  if (!entityType) return null;
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(entityType)) return null;
  return entityType;
}

function flattenProperties(
  record: EntityRecord,
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {
    entityId: record.entityId,
    entityType: record.entityType ?? "Entity",
    ontologyId: record.ontologyId,
    tenantId: record.tenantId,
    domainId: record.domainId,
    version: record.version,
    updatedAt: record.updatedAt,
  };
  for (const [key, value] of Object.entries(record.properties)) {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      out[key] = value;
    } else if (value !== undefined) {
      out[key] = JSON.stringify(value);
    }
  }
  return out;
}

/** Bolt-backed Neo4j read model for ontology entities and LINK relationships. */
export class Neo4jGraphStore {
  private readonly driver: Driver;
  private readonly database?: string;
  private readonly maxRows: number;
  private readonly queryTimeoutMs: number;

  constructor(config: Neo4jGraphStoreConfig) {
    this.driver = neo4j.driver(
      config.uri,
      neo4j.auth.basic(config.user, config.password),
    );
    this.database = config.database;
    this.maxRows = config.maxRows ?? DEFAULT_MAX_ROWS;
    this.queryTimeoutMs = config.queryTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  static fromEnv(env: NodeJS.ProcessEnv = process.env): Neo4jGraphStore | null {
    const uri = env.DAEMON_NEO4J_URI;
    if (!uri) return null;
    const user =
      env.DAEMON_NEO4J_QUERY_USER ??
      env.DAEMON_NEO4J_USER ??
      "neo4j";
    const password =
      env.DAEMON_NEO4J_QUERY_PASSWORD ??
      env.DAEMON_NEO4J_PASSWORD ??
      "";
    if (!password) return null;
    return new Neo4jGraphStore({ uri, user, password });
  }

  async close(): Promise<void> {
    await this.driver.close();
  }

  async ping(): Promise<boolean> {
    const session = this.openSession();
    try {
      await session.run("RETURN 1 AS ok");
      return true;
    } catch {
      return false;
    } finally {
      await session.close();
    }
  }

  async ensureSchema(constraintStatements: string[]): Promise<void> {
    const session = this.openSession();
    try {
      for (const statement of constraintStatements) {
        await session.run(statement);
      }
    } finally {
      await session.close();
    }
  }

  async upsertEntity(
    record: EntityRecord,
    options?: { typeLabel?: string | null },
  ): Promise<void> {
    const typeLabel = options?.typeLabel ?? sanitizeTypeLabel(record.entityType);
    const labelClause = typeLabel ? `:Entity:${typeLabel}` : ":Entity";
    const props = flattenProperties(record);
    const session = this.openSession();
    try {
      await session.run(
        `MERGE (n${labelClause} {
           tenantId: $tenantId,
           domainId: $domainId,
           ontologyId: $ontologyId,
           entityId: $entityId
         })
         SET n += $props`,
        {
          tenantId: record.tenantId,
          domainId: record.domainId,
          ontologyId: record.ontologyId,
          entityId: record.entityId,
          props,
        },
      );
    } finally {
      await session.close();
    }
  }

  async upsertLink(record: EntityRecord): Promise<void> {
    const fromId = String(record.properties.fromEntityId ?? "");
    const toId = String(record.properties.toEntityId ?? "");
    const linkType = String(record.properties.linkType ?? "related");
    if (!fromId || !toId) return;

    const session = this.openSession();
    try {
      await session.run(
        `MATCH (a:Entity {
           tenantId: $tenantId, domainId: $domainId,
           entityId: $fromId
         })
         MATCH (b:Entity {
           tenantId: $tenantId, domainId: $domainId,
           entityId: $toId
         })
         MERGE (a)-[r:LINK {
           tenantId: $tenantId,
           domainId: $domainId,
           linkType: $linkType
         }]->(b)
         SET r.linkEntityId = $linkEntityId,
             r.ontologyId = $linkOntologyId`,
        {
          tenantId: record.tenantId,
          domainId: record.domainId,
          fromId,
          toId,
          linkType,
          linkEntityId: record.entityId,
          linkOntologyId: record.ontologyId,
        },
      );
    } finally {
      await session.close();
    }
  }

  async runReadQuery(
    cypher: string,
    params: Record<string, unknown>,
    options?: ReadQueryOptions,
  ): Promise<Record<string, unknown>[]> {
    const maxRows = options?.maxRows ?? this.maxRows;
    const timeoutMs = options?.timeoutMs ?? this.queryTimeoutMs;
    const session = this.openSession(neo4j.session.READ);
    try {
      const result = await session.run(cypher, params, {
        timeout: timeoutMs,
      });
      return result.records
        .slice(0, maxRows)
        .map((rec) => rec.toObject() as Record<string, unknown>);
    } finally {
      await session.close();
    }
  }

  async countEntities(scope: {
    tenantId: string;
    domainId: string;
  }): Promise<number> {
    const session = this.openSession(neo4j.session.READ);
    try {
      const result = await session.run(
        `MATCH (n:Entity { tenantId: $tenantId, domainId: $domainId })
         RETURN count(n) AS c`,
        scope,
      );
      const c = result.records[0]?.get("c");
      return neo4j.isInt(c) ? c.toNumber() : Number(c ?? 0);
    } finally {
      await session.close();
    }
  }

  private openSession(
    defaultAccessMode = neo4j.session.WRITE,
  ): ReturnType<Driver["session"]> {
    return this.driver.session({
      database: this.database,
      defaultAccessMode,
    });
  }
}
