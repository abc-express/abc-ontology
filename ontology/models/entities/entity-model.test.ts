import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DaemonError } from "@daemon/platform-types";
import { EntityModel, matchesType } from "./entity-model.js";

describe("matchesType", () => {
  it("validates primitives", () => {
    assert.equal(matchesType("x", "string"), true);
    assert.equal(matchesType(1, "number"), true);
    assert.equal(matchesType(Number.NaN, "number"), false);
    assert.equal(matchesType(true, "boolean"), true);
    assert.equal(matchesType([], "array"), true);
    assert.equal(matchesType({}, "object"), true);
    assert.equal(matchesType([], "object"), false);
    assert.equal(matchesType(null, "object"), false);
  });
});

describe("EntityModel", () => {
  const model = new EntityModel({
    ontologyId: "user",
    fields: [
      { name: "name", type: "string", required: true },
      { name: "age", type: "number" },
    ],
  });

  it("accepts valid props", () => {
    const result = model.validate({ name: "Ada", age: 36 });
    assert.equal(result.valid, true);
    assert.equal(result.issues.length, 0);
  });

  it("flags missing required field", () => {
    const result = model.validate({ age: 36 });
    assert.equal(result.valid, false);
    assert.equal(result.issues[0]?.field, "name");
  });

  it("flags type mismatch", () => {
    const result = model.validate({ name: "Ada", age: "old" });
    assert.equal(result.valid, false);
    assert.equal(result.issues[0]?.field, "age");
  });

  it("allows optional field to be absent", () => {
    assert.equal(model.validate({ name: "Ada" }).valid, true);
  });

  it("rejects duplicate fields", () => {
    assert.throws(
      () =>
        new EntityModel({
          ontologyId: "x",
          fields: [
            { name: "a", type: "string" },
            { name: "a", type: "number" },
          ],
        }),
      DaemonError,
    );
  });

  it("rejects empty ontologyId", () => {
    assert.throws(
      () => new EntityModel({ ontologyId: "  ", fields: [] }),
      DaemonError,
    );
  });
});
