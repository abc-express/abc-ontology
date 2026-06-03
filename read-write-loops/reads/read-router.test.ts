import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ReadRouter } from "./read-router.js";
import { globalRegistry } from "@daemon/ontology";
import { DaemonError, ErrorCodes, ontologyId } from "@daemon/platform-types";

describe("ReadRouter", () => {
  it("returns registered entity", () => {
    const ont = ontologyId("Test");
    const e = globalRegistry.register(ont, { x: 1 });
    const router = new ReadRouter();
    const got = router.route({ ontologyId: ont, entityId: e.entityId });
    assert.equal(got.properties.x, 1);
  });

  it("throws DaemonError NOT_FOUND for missing entity", () => {
    const router = new ReadRouter();
    assert.throws(
      () => router.route({ ontologyId: ontologyId("default"), entityId: "my-entity" }),
      (err: unknown) =>
        err instanceof DaemonError &&
        err.code === ErrorCodes.NOT_FOUND &&
        err.status === 404,
    );
  });
});
