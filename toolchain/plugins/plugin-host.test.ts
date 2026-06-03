import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PluginHost } from "./plugin-host.js";
import { referencePlugin } from "./validators/reference-plugin.js";

describe("PluginHost", () => {
  it("loads reference plugin and registers entity types", () => {
    const host = new PluginHost();
    host.register(referencePlugin);
    assert.deepEqual(host.entityTypesRegistered(), ["ReferenceAsset"]);
    assert.equal(host.list()[0]?.id, "reference-validator");
  });
});
