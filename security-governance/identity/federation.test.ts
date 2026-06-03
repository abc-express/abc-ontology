import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DaemonError } from "@daemon/platform-types";
import { FederationBroker } from "./federation.js";

describe("FederationBroker", () => {
  it("maps external groups to local roles", () => {
    const broker = new FederationBroker();
    broker.register({
      issuer: "okta",
      roleMap: { "eng-admins": ["admin"], "eng": ["editor"] },
    });
    const principal = broker.exchange({
      issuer: "okta",
      subject: "u-1",
      tenantId: "t1",
      groups: ["eng", "eng-admins"],
    });
    assert.deepEqual(principal.roles.sort(), ["admin", "editor"]);
  });

  it("rejects unknown issuers", () => {
    const broker = new FederationBroker();
    assert.throws(
      () =>
        broker.exchange({
          issuer: "ghost",
          subject: "u",
          tenantId: "t",
          groups: [],
        }),
      (err) => err instanceof DaemonError && err.code === "UNAUTHORIZED",
    );
  });

  it("denies when no roles map", () => {
    const broker = new FederationBroker();
    broker.register({ issuer: "okta", roleMap: { admins: ["admin"] } });
    assert.throws(
      () =>
        broker.exchange({
          issuer: "okta",
          subject: "u",
          tenantId: "t",
          groups: ["unmapped"],
        }),
      (err) => err instanceof DaemonError && err.code === "POLICY_DENIED",
    );
  });
});
