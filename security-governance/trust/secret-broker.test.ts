import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DaemonError } from "@daemon/platform-types";
import { SecretBroker } from "./secret-broker.js";

describe("SecretBroker", () => {
  it("leases a stored secret with an expiry", () => {
    let clock = 1000;
    const broker = new SecretBroker(() => clock);
    broker.put("db/password", "hunter2");
    const lease = broker.lease("db/password", 5000);
    assert.equal(lease.value, "hunter2");
    assert.equal(lease.expiresAt, 6000);
    assert.equal(broker.isValid(lease), true);
    clock = 7000;
    assert.equal(broker.isValid(lease), false);
  });

  it("rejects missing secrets", () => {
    const broker = new SecretBroker();
    assert.throws(
      () => broker.lease("nope", 1000),
      (err) => err instanceof DaemonError && err.code === "NOT_FOUND",
    );
  });

  it("never exposes values when listing refs", () => {
    const broker = new SecretBroker();
    broker.put("a", "v1");
    broker.put("b", "v2");
    assert.deepEqual(broker.refs(), ["a", "b"]);
  });
});
