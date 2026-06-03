import type {
  EntityRecord,
  OntologyRegistry,
  RegistryEvent,
} from "../../registry/ontology-registry.js";

/** A denormalized, query-friendly snapshot of an entity. */
export interface EntityReadModel {
  key: string;
  ontologyId: string;
  entityId: string;
  properties: Record<string, unknown>;
  version: number;
  updatedAt: string;
}

/**
 * Maintains denormalized entity read models fed from registry events. The
 * projection is eventually consistent with the registry: it applies each
 * `registered`/`patched` event to keep a fast read view without re-querying
 * the system of record.
 */
export class EntityReadModelProjection {
  private readonly views = new Map<string, EntityReadModel>();
  private unsubscribe?: () => void;

  /** Folds a single registry event into the read model store. */
  apply(event: RegistryEvent): void {
    const view = toReadModel(event.record);
    this.views.set(view.key, view);
  }

  /** Attaches to a registry so future mutations update this projection. */
  attach(registry: OntologyRegistry): void {
    this.detach();
    this.unsubscribe = registry.subscribe((event) => this.apply(event));
  }

  /** Detaches from the registry, if attached. */
  detach(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }

  /** Returns a read model by ontology + entity id, if present. */
  get(ontologyId: string, entityId: string): EntityReadModel | undefined {
    return this.views.get(`${ontologyId}:${entityId}`);
  }

  /** Lists all read models for an ontology, sorted by entity id. */
  list(ontologyId: string): EntityReadModel[] {
    return [...this.views.values()]
      .filter((v) => v.ontologyId === ontologyId)
      .sort((a, b) => a.entityId.localeCompare(b.entityId));
  }

  get size(): number {
    return this.views.size;
  }
}

function toReadModel(record: EntityRecord): EntityReadModel {
  return {
    key: `${record.ontologyId}:${record.entityId}`,
    ontologyId: String(record.ontologyId),
    entityId: String(record.entityId),
    properties: { ...record.properties },
    version: record.version,
    updatedAt: record.updatedAt,
  };
}
