import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DaemonError } from "@daemon/platform-types";
import { StateModel } from "./state-model.js";

describe("StateModel", () => {
  const model = new StateModel({
    name: "order",
    initial: "draft",
    states: ["draft", "submitted", "shipped", "cancelled"],
    transitions: [
      { from: "draft", to: "submitted", on: "submit" },
      { from: "submitted", to: "shipped", on: "ship" },
      { from: "draft", to: "cancelled", on: "cancel" },
      { from: "submitted", to: "cancelled", on: "cancel" },
    ],
  });

  it("exposes initial state", () => {
    assert.equal(model.initial, "draft");
  });

  it("computes next state", () => {
    assert.equal(model.next("draft", "submit"), "submitted");
    assert.equal(model.next("submitted", "ship"), "shipped");
  });

  it("reports fireability", () => {
    assert.equal(model.canFire("draft", "submit"), true);
    assert.equal(model.canFire("shipped", "submit"), false);
  });

  it("rejects invalid transition", () => {
    assert.throws(() => model.next("shipped", "submit"), DaemonError);
  });

  it("rejects unknown source state", () => {
    assert.throws(() => model.next("nope", "submit"), DaemonError);
  });

  it("rejects initial not in states", () => {
    assert.throws(
      () =>
        new StateModel({
          name: "x",
          initial: "missing",
          states: ["a"],
          transitions: [],
        }),
      DaemonError,
    );
  });

  it("rejects ambiguous transitions", () => {
    assert.throws(
      () =>
        new StateModel({
          name: "x",
          initial: "a",
          states: ["a", "b", "c"],
          transitions: [
            { from: "a", to: "b", on: "go" },
            { from: "a", to: "c", on: "go" },
          ],
        }),
      DaemonError,
    );
  });
});
