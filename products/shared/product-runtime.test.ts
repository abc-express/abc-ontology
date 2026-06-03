import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ProductRuntime } from "./product-runtime.js";
import { DaemonError } from "@daemon/platform-types";

describe("ProductRuntime", () => {
  it("allows default product actions", () => {
    const rt = new ProductRuntime();
    assert.equal(rt.assertAllowed("query", "analytics").effect, "allow");
  });

  it("denies unknown actions", () => {
    const rt = new ProductRuntime();
    assert.throws(
      () => rt.assertAllowed("delete", "everything"),
      (err: unknown) => err instanceof DaemonError,
    );
  });
});
