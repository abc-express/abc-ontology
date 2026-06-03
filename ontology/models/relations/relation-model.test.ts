import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DaemonError } from "@daemon/platform-types";
import { RelationModel } from "./relation-model.js";

describe("RelationModel", () => {
  it("links and queries many-to-many", () => {
    const rel = new RelationModel({
      name: "member-of",
      from: "user",
      to: "group",
      cardinality: "many-to-many",
    });
    rel.link("u1", "g1");
    rel.link("u1", "g2");
    rel.link("u2", "g1");
    assert.deepEqual(rel.targetsOf("u1").sort(), ["g1", "g2"]);
    assert.deepEqual(rel.sourcesOf("g1").sort(), ["u1", "u2"]);
  });

  it("enforces one-to-many on target", () => {
    const rel = new RelationModel({
      name: "owns",
      from: "user",
      to: "device",
      cardinality: "one-to-many",
    });
    rel.link("u1", "d1");
    rel.link("u1", "d2");
    assert.throws(() => rel.link("u2", "d1"), DaemonError);
  });

  it("enforces one-to-one", () => {
    const rel = new RelationModel({
      name: "passport",
      from: "user",
      to: "passport",
      cardinality: "one-to-one",
    });
    rel.link("u1", "p1");
    assert.throws(() => rel.link("u1", "p2"), DaemonError);
    assert.throws(() => rel.link("u2", "p1"), DaemonError);
  });

  it("is idempotent for repeated identical links", () => {
    const rel = new RelationModel({
      name: "passport",
      from: "user",
      to: "passport",
      cardinality: "one-to-one",
    });
    rel.link("u1", "p1");
    rel.link("u1", "p1");
    assert.deepEqual(rel.targetsOf("u1"), ["p1"]);
  });

  it("rejects blank ids", () => {
    const rel = new RelationModel({
      name: "r",
      from: "a",
      to: "b",
      cardinality: "many-to-many",
    });
    assert.throws(() => rel.link("", "x"), DaemonError);
  });
});
