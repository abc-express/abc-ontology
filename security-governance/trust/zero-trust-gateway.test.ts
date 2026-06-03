import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ZeroTrustGateway } from "./zero-trust-gateway.js";

describe("ZeroTrustGateway", () => {
  const gw = new ZeroTrustGateway();

  it("denies unauthenticated requests regardless of tier", () => {
    const d = gw.evaluate({
      authenticated: false,
      devicePosture: 1,
      trustedNetwork: true,
      resourceTier: "public",
    });
    assert.equal(d.effect, "deny");
  });

  it("allows public resources for any authenticated caller", () => {
    const d = gw.evaluate({
      authenticated: true,
      devicePosture: 0,
      trustedNetwork: false,
      resourceTier: "public",
    });
    assert.equal(d.effect, "allow");
  });

  it("requires posture and trusted network for restricted resources", () => {
    const lowPosture = gw.evaluate({
      authenticated: true,
      devicePosture: 0.5,
      trustedNetwork: true,
      resourceTier: "restricted",
    });
    assert.equal(lowPosture.effect, "deny");

    const untrusted = gw.evaluate({
      authenticated: true,
      devicePosture: 0.9,
      trustedNetwork: false,
      resourceTier: "restricted",
    });
    assert.equal(untrusted.effect, "deny");

    const ok = gw.evaluate({
      authenticated: true,
      devicePosture: 0.9,
      trustedNetwork: true,
      resourceTier: "restricted",
    });
    assert.equal(ok.effect, "allow");
  });
});
