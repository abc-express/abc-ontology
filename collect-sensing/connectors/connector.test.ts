import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { toRawRecords } from "./connector.js";

describe("connector — toRawRecords", () => {
  it("wraps rows and lifts a record id from the configured key", () => {
    const recs = toRawRecords(
      "src-1",
      [
        { id: "a", name: "alpha" },
        { id: "b", name: "beta" },
      ],
      "id",
    );
    assert.equal(recs.length, 2);
    assert.deepEqual(recs[0], {
      sourceId: "src-1",
      recordId: "a",
      payload: { id: "a", name: "alpha" },
    });
    assert.equal(recs[1]?.recordId, "b");
  });

  it("omits recordId when key is absent or value is nullish", () => {
    const [r] = toRawRecords("src-1", [{ name: "x" }], "id");
    assert.equal(r?.recordId, undefined);
    assert.ok(!("recordId" in (r ?? {})));

    const [r2] = toRawRecords("src-1", [{ id: null, name: "x" }], "id");
    assert.equal(r2?.recordId, undefined);
  });
});
