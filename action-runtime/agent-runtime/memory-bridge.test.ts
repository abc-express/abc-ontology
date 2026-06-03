import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MemoryBridge } from "./memory-bridge.js";

describe("MemoryBridge", () => {
  it("recalls most recent first", () => {
    let t = 0;
    const mem = new MemoryBridge(10, () => ++t);
    mem.remember("first");
    mem.remember("second");
    const recent = mem.recall(1);
    assert.equal(recent[0].content, "second");
  });

  it("filters recall by tags", () => {
    let t = 0;
    const mem = new MemoryBridge(10, () => ++t);
    mem.remember("a", ["task"]);
    mem.remember("b", ["task", "error"]);
    mem.remember("c", ["note"]);
    const errs = mem.recall(10, ["error"]);
    assert.equal(errs.length, 1);
    assert.equal(errs[0].content, "b");
  });

  it("evicts oldest beyond capacity", () => {
    let t = 0;
    const mem = new MemoryBridge(2, () => ++t);
    mem.remember("1");
    mem.remember("2");
    mem.remember("3");
    assert.equal(mem.size(), 2);
    const all = mem.recall(10);
    assert.deepEqual(all.map((r) => r.content), ["3", "2"]);
  });
});
