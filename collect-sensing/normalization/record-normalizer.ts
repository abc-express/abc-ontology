/** Spec: collect-sensing/normalization/record-normalizer.ts */
import type { RawRecord } from "../connectors/connector.js";
import { canonicalMap } from "./canonical-mapper.js";
import { enrichMetadata } from "./metadata-enricher.js";

/**
 * Normalized payload ready to be registered as an ontology entity. Mirrors the
 * shape accepted by the ontology registry's `register` API and the Go ingest
 * endpoint (`POST /ingest/records`).
 */
export interface EntityPayload {
  ontologyId: string;
  entityId?: string;
  properties: Record<string, unknown>;
}

export interface RecordNormalizerConfig {
  /** Target ontology every produced payload is registered under. */
  ontologyId: string;
  /** Map of source field name -> canonical (ontology) field name. */
  mapping: Record<string, string>;
  /**
   * Canonical field whose value becomes the entity id when the raw record does
   * not already carry a `recordId`.
   */
  idField?: string;
  /** Static metadata merged into every record's `_meta` envelope. */
  meta?: Record<string, unknown>;
}

/**
 * Transforms {@link RawRecord}s into ontology {@link EntityPayload}s by applying
 * a canonical field mapping and enriching with provenance metadata. Pure and
 * deterministic given its configuration.
 */
export class RecordNormalizer {
  constructor(private readonly config: RecordNormalizerConfig) {
    if (!config.ontologyId.trim()) {
      throw new Error("RecordNormalizer requires a non-empty ontologyId");
    }
    if (Object.keys(config.mapping).length === 0) {
      throw new Error("RecordNormalizer requires a non-empty mapping");
    }
  }

  normalize(record: RawRecord): EntityPayload {
    const mapped = canonicalMap(record.payload, this.config.mapping);
    const properties = enrichMetadata(mapped, {
      sourceId: record.sourceId,
      ...(record.recordId !== undefined ? { recordId: record.recordId } : {}),
      ...this.config.meta,
    });

    const entityId = this.resolveEntityId(record, mapped);
    return entityId === undefined
      ? { ontologyId: this.config.ontologyId, properties }
      : { ontologyId: this.config.ontologyId, entityId, properties };
  }

  normalizeMany(records: ReadonlyArray<RawRecord>): EntityPayload[] {
    return records.map((r) => this.normalize(r));
  }

  private resolveEntityId(
    record: RawRecord,
    mapped: Record<string, unknown>,
  ): string | undefined {
    if (record.recordId !== undefined) return record.recordId;
    const { idField } = this.config;
    if (idField && mapped[idField] != null) return String(mapped[idField]);
    return undefined;
  }
}
