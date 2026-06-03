import type {
  OntologyRegistry,
  RegistryEvent,
} from "../../registry/ontology-registry.js";

/** Extracts a grouping key from an entity's properties. */
export type GroupBy = (properties: Record<string, unknown>) => string;

export interface ViewBucket {
  key: string;
  count: number;
  entityIds: string[];
}

/**
 * A materialized aggregate view fed from registry events. Each entity is
 * assigned to exactly one bucket by `groupBy`; the view tracks per-bucket
 * counts and membership so grouped queries do not rescan the registry.
 *
 * Patches can move an entity between buckets, so the projection records each
 * entity's current bucket to keep counts accurate without double counting.
 */
export class MaterializedView {
  private readonly buckets = new Map<string, Set<string>>();
  /** entity key -> current bucket key, for relocation on patch */
  private readonly assignment = new Map<string, string>();
  private unsubscribe?: () => void;

  constructor(
    private readonly name: string,
    private readonly groupBy: GroupBy,
  ) {}

  apply(event: RegistryEvent): void {
    const entityKey = `${event.record.ontologyId}:${event.record.entityId}`;
    const nextBucket = this.groupBy(event.record.properties);
    const prevBucket = this.assignment.get(entityKey);

    if (prevBucket !== undefined && prevBucket !== nextBucket) {
      this.buckets.get(prevBucket)?.delete(entityKey);
      if (this.buckets.get(prevBucket)?.size === 0) {
        this.buckets.delete(prevBucket);
      }
    }

    let members = this.buckets.get(nextBucket);
    if (!members) {
      members = new Set();
      this.buckets.set(nextBucket, members);
    }
    members.add(entityKey);
    this.assignment.set(entityKey, nextBucket);
  }

  attach(registry: OntologyRegistry): void {
    this.detach();
    this.unsubscribe = registry.subscribe((event) => this.apply(event));
  }

  detach(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }

  get viewName(): string {
    return this.name;
  }

  /** Returns the count for a single bucket. */
  countFor(key: string): number {
    return this.buckets.get(key)?.size ?? 0;
  }

  /** Returns all buckets sorted by descending count, then key. */
  snapshot(): ViewBucket[] {
    return [...this.buckets.entries()]
      .map(([key, members]) => ({
        key,
        count: members.size,
        entityIds: [...members].sort(),
      }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  }
}
