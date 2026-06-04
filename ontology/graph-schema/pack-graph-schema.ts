import { loadFoundationPack, type LoadedOntologyPack } from "../packs/load-pack.js";

export type GraphFieldSpec = {
  name: string;
  type: string;
  required: boolean;
};

export type GraphEntitySchema = {
  entityType: string;
  fields: GraphFieldSpec[];
};

export type PackGraphSchema = {
  ontologyId: string;
  version: string;
  entityTypes: string[];
  entities: GraphEntitySchema[];
  relationTypes: string[];
  /** Cypher DDL statements (constraints/indexes) for ensureSchema */
  constraintStatements: string[];
  /** Text block for LLM system prompts */
  promptSchemaSummary: string;
};

const SYSTEM_NODE_PROPS = [
  "entityId",
  "entityType",
  "ontologyId",
  "tenantId",
  "domainId",
  "version",
  "updatedAt",
] as const;

const LINK_REL_PROPS = ["linkType", "tenantId", "domainId", "linkEntityId"] as const;

function fieldSpecsFromPack(pack: LoadedOntologyPack): GraphEntitySchema[] {
  return [...pack.models.entries()].map(([entityType, model]) => ({
    entityType,
    fields: model.fields().map((f) => ({
      name: f.name,
      type: f.type,
      required: Boolean(f.required),
    })),
  }));
}

export function buildPackGraphSchema(
  pack: LoadedOntologyPack = loadFoundationPack(),
): PackGraphSchema {
  const entities = fieldSpecsFromPack(pack);
  const entityTypes = pack.manifest.entityTypes;

  const constraintStatements = [
    `CREATE CONSTRAINT entity_scope_key IF NOT EXISTS
FOR (n:Entity)
REQUIRE (n.tenantId, n.domainId, n.ontologyId, n.entityId) IS NODE KEY`,
    `CREATE INDEX entity_type_scope IF NOT EXISTS
FOR (n:Entity) ON (n.tenantId, n.domainId, n.entityType)`,
  ];

  const entityBlocks = entities
    .map((e) => {
      const fields = e.fields.map((f) => `  - ${f.name} (${f.type})`).join("\n");
      return `Label :Entity:${e.entityType}\n${fields}`;
    })
    .join("\n\n");

  const promptSchemaSummary = [
    `Ontology: ${pack.manifest.ontologyId} v${pack.manifest.version}`,
    "",
    "Nodes:",
    "- Label :Entity plus type label per entityType",
    `- Types: ${entityTypes.join(", ")}`,
    `- System properties on every node: ${SYSTEM_NODE_PROPS.join(", ")}`,
    "",
    "Entity property catalogs:",
    entityBlocks,
    "",
    "Relationships:",
    "- Type :LINK (directed)",
    `- Properties: ${LINK_REL_PROPS.join(", ")}`,
    "- Endpoints identified by Entity node keys (entityId + scope)",
    "",
    "Tenancy:",
    "- Always filter with $tenantId and $domainId parameters on nodes and LINK rels",
    "- Never return data outside the caller scope",
  ].join("\n");

  return {
    ontologyId: pack.manifest.ontologyId,
    version: pack.manifest.version,
    entityTypes,
    entities,
    relationTypes: pack.manifest.relationTypes ?? ["Link"],
    constraintStatements,
    promptSchemaSummary,
  };
}

export function isAllowedEntityLabel(
  entityType: string,
  pack: LoadedOntologyPack = loadFoundationPack(),
): boolean {
  return pack.manifest.entityTypes.includes(entityType);
}
