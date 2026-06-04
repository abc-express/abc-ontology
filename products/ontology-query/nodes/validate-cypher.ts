import {
  assertTenantScopedCypher,
  validateReadOnlyCypher,
} from "../validate-cypher.js";
import type { OntologyQueryStateType } from "../state.js";

export function validateCypherNode(
  state: OntologyQueryStateType,
): Partial<OntologyQueryStateType> {
  if (state.error) return {};
  if (!state.cypher) {
    return { error: "no Cypher generated" };
  }
  try {
    validateReadOnlyCypher(state.cypher);
    assertTenantScopedCypher(state.cypher);
    return { error: undefined };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
