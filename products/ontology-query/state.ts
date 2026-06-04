import { Annotation } from "@langchain/langgraph";

export const OntologyQueryState = Annotation.Root({
  question: Annotation<string>,
  tenantId: Annotation<string>,
  domainId: Annotation<string>,
  schemaSummary: Annotation<string>,
  cypher: Annotation<string | undefined>,
  cypherParams: Annotation<Record<string, unknown>>,
  rawResult: Annotation<Record<string, unknown>[]>,
  answer: Annotation<string | undefined>,
  error: Annotation<string | undefined>,
});

export type OntologyQueryStateType = typeof OntologyQueryState.State;
