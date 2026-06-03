import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { entityId, ontologyId } from "@daemon/platform-types";
import { globalRegistry } from "@daemon/ontology";
import { CommandGateway } from "./command-gateway.js";

describe("CommandGateway", () => {
  it("idempotency returns same writeId", () => {
    const ont = ontologyId("idem");
    globalRegistry.register(ont, { n: 0 }, entityId("e1"));
    const gw = new CommandGateway();
    const session = {
      sessionId: "s1" as never,
      subjectId: "u1",
      tenantId: "default",
      roles: [],
      issuedAt: new Date().toISOString(),
    };
    const cmd = {
      session,
      ontologyId: ont,
      entityId: entityId("e1"),
      patch: { n: 1 },
      idempotencyKey: "k1",
    };
    const a = gw.submit(cmd);
    const b = gw.submit(cmd);
    assert.equal(a.writeId, b.writeId);
  });
});
