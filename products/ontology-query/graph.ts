import { END, START, StateGraph } from "@langchain/langgraph";
import type { Neo4jGraphStore } from "@daemon/data-platform/graph-store/neo4j-graph-store";
import { OntologyQueryState, type OntologyQueryStateType } from "./state.js";
import type { TextLlm } from "./llm.js";
import { generateCypherNode } from "./nodes/generate-cypher.js";
import { validateCypherNode } from "./nodes/validate-cypher.js";
import { executeCypherNode } from "./nodes/execute-cypher.js";
import { generateAnswerNode } from "./nodes/generate-answer.js";

export type OntologyQueryGraphDeps = {
  store: Neo4jGraphStore;
  llm: TextLlm;
};

export function buildOntologyQueryGraph(deps: OntologyQueryGraphDeps) {
  const graph = new StateGraph(OntologyQueryState)
    .addNode("generateCypher", (state) => generateCypherNode(state, deps.llm))
    .addNode("validateCypher", validateCypherNode)
    .addNode("executeCypher", (state) => executeCypherNode(state, deps.store))
    .addNode("generateAnswer", (state) => generateAnswerNode(state, deps.llm))
    .addEdge(START, "generateCypher")
    .addEdge("generateCypher", "validateCypher")
    .addEdge("validateCypher", "executeCypher")
    .addEdge("executeCypher", "generateAnswer")
    .addEdge("generateAnswer", END);

  return graph.compile();
}

export async function runOntologyQueryGraph(
  deps: OntologyQueryGraphDeps,
  input: OntologyQueryStateType,
): Promise<OntologyQueryStateType> {
  const app = buildOntologyQueryGraph(deps);
  return app.invoke(input);
}
