import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CommandExecutor } from "./command-executor.js";

describe("CommandExecutor", () => {
  it("accepts named commands", () => {
    const ex = new CommandExecutor();
    const r = ex.execute({ name: "sync", payload: { x: 1 } });
    assert.equal(r.accepted, true);
    assert.equal(r.name, "sync");
  });
});
