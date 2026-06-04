import { Injectable } from "@nestjs/common";
import { entityId, ontologyId } from "@daemon/platform-types";
import type { EntityRecord } from "@daemon/context-ports";
import {
  PostgresEntityJournal,
  type EntityListPageResult,
} from "@daemon/data-platform/operational-store/entity-journal";
import { DurableOntologyStore } from "@daemon/ontology/store/durable-ontology-store.js";
import { DaemonRuntime } from "../platform/daemon-runtime";
import type { TenantContextHeaders } from "../platform/tenant-context";

export interface ListEntitiesQuery {
  ontologyId: string;
  entityType?: string;
  limit?: number;
  cursor?: string;
  updatedAfter?: string;
}

@Injectable()
export class ReadService {
  constructor(private readonly runtime: DaemonRuntime) {}

  ensureSeed(ctx: TenantContextHeaders) {
    const scope = { tenantId: ctx.tenantId, domainId: ctx.domainId };
    const ont = ontologyId("foundation");
    const id = entityId("ent-1");
    if (!this.runtime.store.get(scope, ont, id)) {
      this.runtime.store.register({
        scope,
        ontologyId: ont,
        properties: { name: "Seed", entityType: "Party" },
        entityId: id,
        entityType: "Party",
      });
    }
  }

  getEntity(ctx: TenantContextHeaders, ont: string, id: string) {
    this.ensureSeed(ctx);
    return this.runtime.reads.route({
      tenantId: ctx.tenantId,
      domainId: ctx.domainId,
      ontologyId: ontologyId(ont),
      entityId: entityId(id),
    });
  }

  async listEntities(
    ctx: TenantContextHeaders,
    query: ListEntitiesQuery,
  ): Promise<EntityListPageResult> {
    this.ensureSeed(ctx);
    const scope = { tenantId: ctx.tenantId, domainId: ctx.domainId };
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const ont = query.ontologyId ?? "foundation";
    const store = this.runtime.store;
    if (store instanceof DurableOntologyStore) {
      const journal = store.entityJournal();
      if (journal instanceof PostgresEntityJournal) {
        return journal.listPage({
          scope,
          ontologyId: ont,
          entityType: query.entityType,
          updatedAfter: query.updatedAfter,
          limit,
          cursor: query.cursor,
        });
      }
    }
    return this.listEntitiesInMemory(scope, ont, query, limit);
  }

  private listEntitiesInMemory(
    scope: { tenantId: string; domainId: string },
    ont: string,
    query: ListEntitiesQuery,
    limit: number,
  ): EntityListPageResult {
    let items: EntityRecord[] = this.runtime.store
      .list(scope, ontologyId(ont))
      .filter((r) => {
        if (query.entityType && r.entityType !== query.entityType) {
          return false;
        }
        if (query.updatedAfter && r.updatedAt < query.updatedAfter) {
          return false;
        }
        if (query.cursor && String(r.entityId) <= query.cursor) {
          return false;
        }
        return true;
      })
      .sort((a, b) => String(a.entityId).localeCompare(String(b.entityId)));
    const page = items.slice(0, limit);
    const nextCursor =
      items.length > limit
        ? String(page[page.length - 1]?.entityId ?? "")
        : null;
    return { items: page, nextCursor };
  }
}
