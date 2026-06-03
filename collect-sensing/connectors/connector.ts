/** Spec: collect-sensing/connectors/connector.ts */

/** A single raw record pulled from an external source, prior to normalization. */
export interface RawRecord {
  /** Identifier of the source this record originated from. */
  readonly sourceId: string;
  /** Stable identifier for the record within the source, when available. */
  readonly recordId?: string;
  /** Arbitrary source payload, mapped to ontology entities by normalization. */
  readonly payload: Record<string, unknown>;
}

/**
 * A source connector knows how to pull a batch of {@link RawRecord}s from one
 * external system. Implementations are deterministic given their inputs so they
 * can be unit-tested without live infrastructure.
 */
export interface SourceConnector {
  /** Discriminator describing the connector family (e.g. "db", "api"). */
  readonly kind: string;
  /** Identifier of the source served by this connector instance. */
  readonly sourceId: string;
  /** Pull the currently available records. */
  fetch(): Promise<RawRecord[]>;
}

/** Wrap a payload list into {@link RawRecord}s for a given source. */
export function toRawRecords(
  sourceId: string,
  rows: ReadonlyArray<Record<string, unknown>>,
  recordIdKey?: string,
): RawRecord[] {
  return rows.map((payload) => {
    const recordId =
      recordIdKey && payload[recordIdKey] != null
        ? String(payload[recordIdKey])
        : undefined;
    return recordId === undefined
      ? { sourceId, payload }
      : { sourceId, recordId, payload };
  });
}
