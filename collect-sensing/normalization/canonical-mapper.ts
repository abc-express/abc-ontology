/** Spec: collect-sensing/normalization/canonical-mapper.ts */
export function canonicalMap(raw: Record<string, unknown>, mapping: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [src, dst] of Object.entries(mapping)) {
    if (src in raw) out[dst] = raw[src];
  }
  return out;
}
