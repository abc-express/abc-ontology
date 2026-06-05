import type { OntologyScope } from "@daemon/context-ports";
import type { AgentWorkerReply } from "../agent-worker/schemas.js";

export type RouteIntent =
  | "ontology_nl"
  | "rag_chat"
  | "tool_research"
  | "parallel";

export type SupervisorInput = {
  message: string;
  scope: OntologyScope;
};

export type SupervisorReply = {
  message: string;
  citations: string[];
  route: RouteIntent;
  partials?: {
    ontology?: string;
    rag?: string;
    research?: AgentWorkerReply;
  };
};
