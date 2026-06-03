import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DaemonError } from "@daemon/platform-types";
import { Authenticator } from "./authn.js";

describe("Authenticator", () => {
  it("resolves a registered api key", () => {
    const auth = new Authenticator();
    auth.registerApiKey("k1", { subjectId: "svc", tenantId: "t1", roles: ["ingest"] });
    const principal = auth.authenticate({ scheme: "apiKey", value: "k1" });
    assert.equal(principal.subjectId, "svc");
    assert.deepEqual(principal.roles, ["ingest"]);
  });

  it("rejects unknown api keys with UNAUTHORIZED", () => {
    const auth = new Authenticator();
    assert.throws(
      () => auth.authenticate({ scheme: "apiKey", value: "nope" }),
      (err) => err instanceof DaemonError && err.code === "UNAUTHORIZED",
    );
  });

  it("decodes a dev bearer token", () => {
    const auth = new Authenticator();
    const principal = auth.authenticate({
      scheme: "bearer",
      value: "alice:t1:admin,user",
    });
    assert.equal(principal.tenantId, "t1");
    assert.deepEqual(principal.roles, ["admin", "user"]);
  });

  it("rejects malformed bearer tokens", () => {
    const auth = new Authenticator();
    assert.throws(
      () => auth.authenticate({ scheme: "bearer", value: "bad-token" }),
      (err) => err instanceof DaemonError && err.code === "UNAUTHORIZED",
    );
  });
});
