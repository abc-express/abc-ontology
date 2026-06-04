import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DaemonError } from "@daemon/platform-types";
import {
  RelationModel,
  parseRelationDefinition,
} from "./relation-model.js";

describe("RelationModel", () => {
  it("validates required link properties", () => {
    const rel = new RelationModel({
      relationType: "member-of",
      fromEntityTypes: ["Party"],
      toEntityTypes: ["Organization"],
    });
    const result = rel.validateLinkProperties({
      linkType: "member-of",
      fromEntityType: "Party",
      toEntityType: "Organization",
      fromEntityId: "party-1",
      toEntityId: "org-1",
    });
    assert.equal(result.valid, true);
    assert.deepEqual(result.issues, []);
  });

  it("rejects missing linkType and entity ids", () => {
    const rel = new RelationModel({
      relationType: "member-of",
      fromEntityTypes: ["Party"],
      toEntityTypes: ["Organization"],
    });
    const result = rel.validateLinkProperties({});
    assert.equal(result.valid, false);
    assert.ok(result.issues.some((i) => i.field === "linkType"));
    assert.ok(result.issues.some((i) => i.field === "fromEntityId"));
    assert.ok(result.issues.some((i) => i.field === "toEntityId"));
  });

  it("rejects entity types outside relation definition", () => {
    const rel = new RelationModel({
      relationType: "owns",
      fromEntityTypes: ["Party"],
      toEntityTypes: ["Case"],
    });
    const result = rel.validateLinkProperties({
      linkType: "owns",
      fromEntityType: "Organization",
      toEntityType: "Case",
      fromEntityId: "a",
      toEntityId: "b",
    });
    assert.equal(result.valid, false);
    assert.ok(result.issues.some((i) => i.field === "fromEntityType"));
  });

  it("exposes definition getters", () => {
    const rel = new RelationModel({
      relationType: "passport",
      fromEntityTypes: ["Party"],
      toEntityTypes: ["Document"],
      cardinality: "one",
    });
    assert.equal(rel.relationType, "passport");
    assert.deepEqual(rel.fromEntityTypes, ["Party"]);
    assert.deepEqual(rel.toEntityTypes, ["Document"]);
  });
});

describe("parseRelationDefinition", () => {
  it("parses from/to aliases", () => {
    const def = parseRelationDefinition({
      relationType: "Link",
      from: ["Party"],
      to: ["Case"],
    });
    assert.equal(def.relationType, "Link");
    assert.deepEqual(def.fromEntityTypes, ["Party"]);
    assert.deepEqual(def.toEntityTypes, ["Case"]);
  });

  it("requires relationType and endpoints", () => {
    assert.throws(
      () => parseRelationDefinition({ relationType: "", from: ["A"], to: ["B"] }),
      DaemonError,
    );
    assert.throws(
      () => parseRelationDefinition({ relationType: "r", from: [], to: ["B"] }),
      DaemonError,
    );
  });
});
