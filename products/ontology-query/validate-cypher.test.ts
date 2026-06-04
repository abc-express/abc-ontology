import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateReadOnlyCypher,
  assertTenantScopedCypher,
  CypherValidationError,
} from "./validate-cypher.js";

describe("validate-cypher", () => {
  it("allows read queries with tenant params", () => {
    const cypher = `MATCH (c:Entity:Case { tenantId: $tenantId, domainId: $domainId })
RETURN c.entityId LIMIT 10`;
    assert.doesNotThrow(() => validateReadOnlyCypher(cypher));
    assert.doesNotThrow(() => assertTenantScopedCypher(cypher));
  });

  it("blocks write keywords", () => {
    assert.throws(
      () => validateReadOnlyCypher("CREATE (n:Entity) RETURN n"),
      CypherValidationError,
    );
  });

  it("requires tenant parameters", () => {
    assert.throws(
      () => assertTenantScopedCypher("MATCH (n) RETURN n"),
      CypherValidationError,
    );
  });
});
