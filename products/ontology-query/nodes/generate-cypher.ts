import type { TextLlm } from "../llm.js";
import { extractCypherBlock } from "../llm.js";
import type { OntologyQueryStateType } from "../state.js";

const SYSTEM = `You generate read-only Neo4j Cypher for a foundation ontology graph.
Rules:
- Output ONLY a single Cypher query (optionally in a cypher fenced block).
- Use parameters $tenantId and $domainId on every node and LINK match.
- Use labels :Entity and type labels :Party, :Case, :Organization, :Event, :Document, :Link.
- Relationship type is :LINK.
- No CREATE, MERGE, SET, DELETE, DROP, or admin procedures.
- Include LIMIT 50 unless the user asks for a count only.`;

export async function generateCypherNode(
  state: OntologyQueryStateType,
  llm: TextLlm,
): Promise<Partial<OntologyQueryStateType>> {
  try {
    const user = [
      "Graph schema:",
      state.schemaSummary,
      "",
      `tenantId parameter: ${state.tenantId}`,
      `domainId parameter: ${state.domainId}`,
      "",
      `Question: ${state.question}`,
    ].join("\n");
    const raw = await llm.complete(SYSTEM, user);
    const cypher = extractCypherBlock(raw);
    return {
      cypher,
      cypherParams: {
        tenantId: state.tenantId,
        domainId: state.domainId,
      },
      error: undefined,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
