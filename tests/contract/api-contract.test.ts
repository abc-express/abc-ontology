import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { entityId, ontologyId } from "@daemon/platform-types";
import { ReadRouter } from "@daemon/read-write-loops/reads/read-router.js";
import { CommandGateway } from "@daemon/read-write-loops/writes/command-gateway.js";
import { globalRegistry } from "@daemon/ontology";

/** Contract: gateway services delegate to read-write-loops semantics. */
describe("API contract (in-process)", () => {
  it("read and write paths match v1 semantics", () => {
    const ont = ontologyId("contract");
    globalRegistry.register(ont, { v: 0 }, entityId("c1"));
    const read = new ReadRouter().route({ ontologyId: ont, entityId: entityId("c1") });
    assert.equal(read.properties.v, 0);
    const gw = new CommandGateway();
    gw.submit({
      session: {
        sessionId: "s" as never,
        subjectId: "u",
        tenantId: "default",
        roles: [],
        issuedAt: new Date().toISOString(),
      },
      ontologyId: ont,
      entityId: entityId("c1"),
      patch: { v: 1 },
    });
    const after = new ReadRouter().route({ ontologyId: ont, entityId: entityId("c1") });
    assert.equal(after.properties.v, 1);
  });
});
