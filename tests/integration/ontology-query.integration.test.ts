import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { entityId, ontologyId } from "@daemon/platform-types";
import { DEFAULT_TENANT_ID, DEFAULT_DOMAIN_ID } from "@daemon/context-ports";
import {
  OntologyQueryChain,
  type TextLlm,
} from "@daemon/ontology-query";
import { buildPackGraphSchema } from "@daemon/ontology/graph-schema/pack-graph-schema.js";
import { skipUnlessNeo4jReady } from "../helpers/neo4j-integration.js";

const scope = { tenantId: DEFAULT_TENANT_ID, domainId: DEFAULT_DOMAIN_ID };

const mockLlm: TextLlm = {
  async complete(system, user) {
    if (system.includes("read-only Neo4j Cypher")) {
      return `\`\`\`cypher
MATCH (c:Entity:Case { tenantId: $tenantId, domainId: $domainId })
RETURN c.entityId AS entityId LIMIT 5
\`\`\``;
    }
    return "Found cases in the graph for this tenant.";
  },
};

describe("ontology query chain (integration)", () => {
  it("runs generate → validate → execute → answer with mock LLM", async (t) => {
    const store = await skipUnlessNeo4jReady(t);
    if (!store) return;

    const schema = buildPackGraphSchema();
    await store.ensureSchema(schema.constraintStatements);
    const ont = ontologyId("foundation");
    await store.upsertEntity(
      {
        tenantId: scope.tenantId,
        domainId: scope.domainId,
        ontologyId: ont,
        entityId: entityId("case-nl-1"),
        entityType: "Case",
        properties: { status: "open", title: "NL test case" },
        version: 1,
        updatedAt: new Date().toISOString(),
      },
      { typeLabel: "Case" },
    );

    const chain = new OntologyQueryChain({
      store,
      llm: mockLlm,
      includeCypherInResponse: true,
    });
    const result = await chain.ask({
      question: "List open cases for this tenant",
      scope,
    });

    assert.ok(result.answer);
    assert.match(result.cypher ?? "", /\$tenantId/);
    assert.equal(result.error, undefined);

    await store.close();
  });
});
