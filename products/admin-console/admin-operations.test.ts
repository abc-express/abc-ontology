import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { globalRegistry } from "@daemon/ontology";
import {
  ontologyId,
  entityId,
  type DaemonSession,
  type SessionId,
} from "@daemon/platform-types";
import { ProductRuntime } from "../shared/product-runtime.js";
import { AdminOperations } from "./admin-operations.js";

function session(): DaemonSession {
  return {
    sessionId: "sess-admin" as SessionId,
    subjectId: "admin-user",
    tenantId: "default",
    roles: ["admin"],
    issuedAt: new Date().toISOString(),
  };
}

describe("AdminOperations", () => {
  it("lists and patches entities", () => {
    const ont = ontologyId("prod-admin");
    const id = entityId("adm-1");
    globalRegistry.register(ont, { status: "draft" }, id);
    const admin = new AdminOperations(new ProductRuntime());
    assert.equal(admin.list(ont).length, 1);
    const result = admin.patchEntity(session(), ont, id, { status: "active" });
    assert.equal(result.version, 2);
    assert.equal(admin.read(ont, id).properties.status, "active");
  });
});
