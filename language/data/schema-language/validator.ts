import { parse } from "yaml";

export type SchemaDocument = {
  apiVersion: string;
  kind: string;
  metadata: { name: string };
  spec: Record<string, unknown>;
};

export function validateSchemaDocument(raw: string): SchemaDocument {
  const doc = parse(raw) as unknown;
  if (!doc || typeof doc !== "object") {
    throw new Error("schema document must be a mapping");
  }
  const d = doc as Record<string, unknown>;
  for (const key of ["apiVersion", "kind", "metadata", "spec"] as const) {
    if (!(key in d)) {
      throw new Error(`missing required field: ${key}`);
    }
  }
  const metadata = d.metadata as Record<string, unknown>;
  if (!metadata?.name || typeof metadata.name !== "string") {
    throw new Error("metadata.name must be a string");
  }
  if (typeof d.spec !== "object" || d.spec === null) {
    throw new Error("spec must be an object");
  }
  return d as SchemaDocument;
}
