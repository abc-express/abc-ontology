/** Spec: collect-sensing/normalization/metadata-enricher.ts */
export function enrichMetadata(record: Record<string, unknown>, meta: Record<string, unknown>): Record<string, unknown> {
  return { ...record, _meta: { ...(record._meta as object ?? {}), ...meta, enrichedAt: new Date().toISOString() } };
}
