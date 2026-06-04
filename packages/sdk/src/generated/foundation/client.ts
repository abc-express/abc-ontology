/** Generated pack client helpers — do not edit by hand. */
import type { DaemonClient } from "../../client.js";
import type { EntityRecord, EntityListPage } from "../../types.js";
import { ONTOLOGY_ID } from "./entities.js";

export const ontologyId = ONTOLOGY_ID;

export const Case = {
  async read(client: DaemonClient, entityId: string): Promise<EntityRecord> {
    return client.readEntity(entityId, ontologyId);
  },
  async list(client: DaemonClient, params?: { limit?: number; cursor?: string; updatedAfter?: string }): Promise<EntityListPage> {
    return client.listEntities({ ontologyId, entityType: "Case", ...params });
  },
};

export const Document = {
  async read(client: DaemonClient, entityId: string): Promise<EntityRecord> {
    return client.readEntity(entityId, ontologyId);
  },
  async list(client: DaemonClient, params?: { limit?: number; cursor?: string; updatedAfter?: string }): Promise<EntityListPage> {
    return client.listEntities({ ontologyId, entityType: "Document", ...params });
  },
};

export const Event = {
  async read(client: DaemonClient, entityId: string): Promise<EntityRecord> {
    return client.readEntity(entityId, ontologyId);
  },
  async list(client: DaemonClient, params?: { limit?: number; cursor?: string; updatedAfter?: string }): Promise<EntityListPage> {
    return client.listEntities({ ontologyId, entityType: "Event", ...params });
  },
};

export const Link = {
  async read(client: DaemonClient, entityId: string): Promise<EntityRecord> {
    return client.readEntity(entityId, ontologyId);
  },
  async list(client: DaemonClient, params?: { limit?: number; cursor?: string; updatedAfter?: string }): Promise<EntityListPage> {
    return client.listEntities({ ontologyId, entityType: "Link", ...params });
  },
};

export const Organization = {
  async read(client: DaemonClient, entityId: string): Promise<EntityRecord> {
    return client.readEntity(entityId, ontologyId);
  },
  async list(client: DaemonClient, params?: { limit?: number; cursor?: string; updatedAfter?: string }): Promise<EntityListPage> {
    return client.listEntities({ ontologyId, entityType: "Organization", ...params });
  },
};

export const Party = {
  async read(client: DaemonClient, entityId: string): Promise<EntityRecord> {
    return client.readEntity(entityId, ontologyId);
  },
  async list(client: DaemonClient, params?: { limit?: number; cursor?: string; updatedAfter?: string }): Promise<EntityListPage> {
    return client.listEntities({ ontologyId, entityType: "Party", ...params });
  },
};

