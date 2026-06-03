import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DaemonError } from "@daemon/platform-types";
import { EventModel } from "./event-model.js";

describe("EventModel", () => {
  const model = new EventModel({
    name: "entity.created",
    ontologyId: "user",
    payload: [
      { name: "entityId", type: "string", required: true },
      { name: "version", type: "number" },
    ],
  });

  it("emits a validated event with timestamp", () => {
    const evt = model.emit({ entityId: "u1", version: 1 }, "2026-01-01T00:00:00Z");
    assert.equal(evt.name, "entity.created");
    assert.equal(evt.ontologyId, "user");
    assert.equal(evt.payload.entityId, "u1");
    assert.equal(evt.occurredAt, "2026-01-01T00:00:00Z");
  });

  it("defaults occurredAt when omitted", () => {
    const evt = model.emit({ entityId: "u1" });
    assert.equal(typeof evt.occurredAt, "string");
    assert.ok(evt.occurredAt.length > 0);
  });

  it("rejects missing required payload field", () => {
    assert.throws(() => model.emit({ version: 1 }), DaemonError);
  });

  it("rejects payload type mismatch", () => {
    assert.throws(() => model.emit({ entityId: 5 }), DaemonError);
  });

  it("rejects blank name", () => {
    assert.throws(
      () => new EventModel({ name: " ", ontologyId: "x", payload: [] }),
      DaemonError,
    );
  });
});
