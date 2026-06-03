import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { globalRegistry } from "@daemon/ontology";
import { ontologyId, entityId } from "@daemon/platform-types";
import { ReadRouter } from "@daemon/read-write-loops/reads/read-router.js";
import { CommandGateway } from "@daemon/read-write-loops/writes/command-gateway.js";

describe("e2e in-process path", () => {
  it("register → read → write", () => {
    const ont = ontologyId("e2e");
    globalRegistry.register(ont, { status: "seed" }, entityId("e2e-1"));
    const read = new ReadRouter().route({
      ontologyId: ont,
      entityId: entityId("e2e-1"),
    });
    assert.equal(read.properties.status, "seed");

    const gw = new CommandGateway();
    const result = gw.submit({
      session: {
        sessionId: "s1" as never,
        subjectId: "u1",
        tenantId: "default",
        roles: [],
        issuedAt: new Date().toISOString(),
      },
      ontologyId: ont,
      entityId: entityId("e2e-1"),
      patch: { status: "active" },
    });
    assert.equal(result.status, "committed");
  });
});
