/** Spec: collect-sensing/normalization/schema-resolver.ts */
export function resolveSchema(typeName: string, schemas: Record<string, object>): object {
  const s = schemas[typeName];
  if (!s) throw new Error(`unknown schema: ${typeName}`);
  return s;
}
