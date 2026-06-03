import type { EntityId, OntologyId } from "@daemon/platform-types";
import { DaemonError, ErrorCodes } from "@daemon/platform-types";
import { entityId, ontologyId } from "@daemon/platform-types";

export interface EntityRecord {
  entityId: EntityId;
  ontologyId: OntologyId;
  properties: Record<string, unknown>;
  version: number;
  updatedAt: string;
}

/**
 * Event emitted by the registry whenever an entity is created or mutated.
 * Projections subscribe to these to maintain derived read models.
 */
export interface RegistryEvent {
  kind: "registered" | "patched";
  record: EntityRecord;
}

export type RegistryListener = (event: RegistryEvent) => void;

export class OntologyRegistry {
  private readonly entities = new Map<string, EntityRecord>();
  private readonly listeners = new Set<RegistryListener>();

  /**
   * Subscribes a listener to registry mutations. Returns an unsubscribe
   * function so callers (such as projections) can detach cleanly.
   */
  subscribe(listener: RegistryListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: RegistryEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  register(
    ont: OntologyId,
    props: Record<string, unknown>,
    id?: EntityId,
  ): EntityRecord {
    const entityIdValue = id ?? entityId(`ent-${this.entities.size + 1}`);
    const key = `${ont}:${entityIdValue}`;
    const record: EntityRecord = {
      entityId: entityIdValue,
      ontologyId: ont,
      properties: { ...props },
      version: 1,
      updatedAt: new Date().toISOString(),
    };
    this.entities.set(key, record);
    this.emit({ kind: "registered", record });
    return record;
  }

  get(ont: OntologyId, id: EntityId): EntityRecord | undefined {
    return this.entities.get(`${ont}:${id}`);
  }

  /**
   * Returns all records, optionally scoped to a single ontology. Used by
   * read models and search surfaces (such as the GraphQL `search` query)
   * that need to enumerate the registry rather than resolve a single id.
   */
  list(ont?: OntologyId): EntityRecord[] {
    const all = [...this.entities.values()];
    return ont ? all.filter((record) => record.ontologyId === ont) : all;
  }

  patch(
    ont: OntologyId,
    id: EntityId,
    patch: Record<string, unknown>,
  ): EntityRecord {
    const key = `${ont}:${id}`;
    const existing = this.entities.get(key);
    if (!existing) {
      throw new DaemonError(
        ErrorCodes.NOT_FOUND,
        `entity not found: ${key}`,
        404,
      );
    }
    const next: EntityRecord = {
      ...existing,
      properties: { ...existing.properties, ...patch },
      version: existing.version + 1,
      updatedAt: new Date().toISOString(),
    };
    this.entities.set(key, next);
    this.emit({ kind: "patched", record: next });
    return next;
  }
}

export const globalRegistry = new OntologyRegistry();

export function defaultOntology(): OntologyId {
  return ontologyId("default");
}
