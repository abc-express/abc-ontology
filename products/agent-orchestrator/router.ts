import type { RouteIntent } from "./types.js";

const ONTOLOGY_HINTS = [
  "cypher",
  "graph",
  "how many",
  "count",
  "relationship",
  "linked",
  "traverse",
];

const RESEARCH_HINTS = ["search", "find", "lookup", "read entity", "entity id"];

const PARALLEL_HINTS = ["compare", "correlate", "both", "and also"];

export function routeIntentHeuristic(message: string): RouteIntent {
  const lower = message.toLowerCase();
  const words = lower.split(/\s+/).length;
  const parallel =
    PARALLEL_HINTS.some((h) => lower.includes(h)) ||
    (words > 24 &&
      ONTOLOGY_HINTS.some((h) => lower.includes(h)) &&
      RESEARCH_HINTS.some((h) => lower.includes(h)));
  if (parallel) return "parallel";
  if (ONTOLOGY_HINTS.some((h) => lower.includes(h))) return "ontology_nl";
  if (RESEARCH_HINTS.some((h) => lower.includes(h))) return "tool_research";
  return "rag_chat";
}
