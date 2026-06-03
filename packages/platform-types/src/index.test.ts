import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DaemonError, ErrorCodes, ontologyId } from "./index.js";

describe("platform-types", () => {
  it("brands ontology ids", () => {
    assert.equal(ontologyId("ont-1"), "ont-1");
  });

  it("constructs DaemonError with code", () => {
    const err = new DaemonError(ErrorCodes.POLICY_DENIED, "denied", 403);
    assert.equal(err.code, "POLICY_DENIED");
    assert.equal(err.status, 403);
  });
});
