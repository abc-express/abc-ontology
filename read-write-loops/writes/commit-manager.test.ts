import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CommitManager } from "./commit-manager.js";

describe("CommitManager", () => {
  it("records commits and reports the latest version per entity", () => {
    const cm = new CommitManager();
    cm.commit({ writeId: "w1", entityKey: "o:e", version: 1 });
    cm.commit({ writeId: "w2", entityKey: "o:e", version: 2 });
    cm.commit({ writeId: "w3", entityKey: "o:other", version: 1 });

    assert.equal(cm.latestVersion("o:e"), 2);
    assert.equal(cm.history("o:e").length, 2);
  });

  it("rolls back the most recent commit for an entity", () => {
    const cm = new CommitManager();
    cm.commit({ writeId: "w1", entityKey: "o:e", version: 1 });
    cm.commit({ writeId: "w2", entityKey: "o:e", version: 2 });

    const removed = cm.rollbackLast("o:e");
    assert.equal(removed?.writeId, "w2");
    assert.equal(cm.latestVersion("o:e"), 1);
  });
});
