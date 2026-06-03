import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DaemonError } from "@daemon/platform-types";
import { TraitModel, composeTraits } from "./trait-model.js";
import type { FieldSpec } from "../entities/entity-model.js";

describe("TraitModel", () => {
  const timestamped = new TraitModel({
    name: "timestamped",
    fields: [
      { name: "createdAt", type: "string", required: true },
      { name: "updatedAt", type: "string", required: true },
    ],
  });

  it("exposes fields", () => {
    assert.equal(timestamped.fields.length, 2);
  });

  it("applies trait fields to a base", () => {
    const base: FieldSpec[] = [{ name: "id", type: "string", required: true }];
    const merged = timestamped.applyTo(base);
    const names = merged.map((f) => f.name).sort();
    assert.deepEqual(names, ["createdAt", "id", "updatedAt"]);
  });

  it("composes multiple traits", () => {
    const soft = new TraitModel({
      name: "soft-delete",
      fields: [{ name: "deletedAt", type: "string" }],
    });
    const base: FieldSpec[] = [{ name: "id", type: "string", required: true }];
    const merged = composeTraits(base, [timestamped, soft]);
    assert.equal(merged.length, 4);
  });

  it("rejects conflicting field type on apply", () => {
    const base: FieldSpec[] = [{ name: "createdAt", type: "number" }];
    assert.throws(() => timestamped.applyTo(base), DaemonError);
  });

  it("rejects duplicate fields in definition", () => {
    assert.throws(
      () =>
        new TraitModel({
          name: "dup",
          fields: [
            { name: "a", type: "string" },
            { name: "a", type: "string" },
          ],
        }),
      DaemonError,
    );
  });

  it("rejects blank name", () => {
    assert.throws(
      () => new TraitModel({ name: "", fields: [] }),
      DaemonError,
    );
  });
});
