import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateSchemaDocument } from "./validator.js";

describe("validateSchemaDocument", () => {
  it("accepts minimal schema mapping", () => {
    const doc = validateSchemaDocument(`
apiVersion: daemon/v1
kind: EntitySchema
metadata:
  name: customer
spec:
  fields:
    - name: id
      type: string
`);
    assert.equal(doc.metadata.name, "customer");
    assert.equal(doc.kind, "EntitySchema");
  });

  it("rejects missing spec", () => {
    assert.throws(() =>
      validateSchemaDocument(`
apiVersion: daemon/v1
kind: EntitySchema
metadata:
  name: broken
`),
    );
  });
});
