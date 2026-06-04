import type { TextLlm } from "../llm.js";
import type { OntologyQueryStateType } from "../state.js";

const SYSTEM = `You answer questions about an ontology graph using query results.
Be concise. If results are empty, say so. Do not invent entity ids not present in the results.`;

export async function generateAnswerNode(
  state: OntologyQueryStateType,
  llm: TextLlm,
): Promise<Partial<OntologyQueryStateType>> {
  if (state.error) {
    return {
      answer: `Unable to answer: ${state.error}`,
    };
  }
  try {
    const user = [
      `Question: ${state.question}`,
      "",
      "Query results (JSON):",
      JSON.stringify(state.rawResult ?? [], null, 2),
    ].join("\n");
    const answer = await llm.complete(SYSTEM, user);
    return { answer };
  } catch (err) {
    return {
      answer: `Unable to summarize results: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
