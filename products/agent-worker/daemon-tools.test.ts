import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isReadOnlyAgentTool } from "./daemon-tools.js";

describe("daemon-tools", () => {
  it("isReadOnlyAgentTool allows search, read_entity, ontology_ask", () => {
    assert.equal(isReadOnlyAgentTool("search"), true);
    assert.equal(isReadOnlyAgentTool("read_entity"), true);
    assert.equal(isReadOnlyAgentTool("ontology_ask"), true);
  });

  it("isReadOnlyAgentTool rejects write-like tool names", () => {
    assert.equal(isReadOnlyAgentTool("write_entity"), false);
    assert.equal(isReadOnlyAgentTool("ingest"), false);
    assert.equal(isReadOnlyAgentTool(""), false);
  });
});
