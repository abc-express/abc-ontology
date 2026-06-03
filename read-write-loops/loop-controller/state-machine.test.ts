import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DaemonError } from "@daemon/platform-types";
import { StateMachine } from "./state-machine.js";

describe("StateMachine", () => {
  it("walks the happy path to committed", () => {
    const sm = new StateMachine();
    sm.transition("reading");
    sm.transition("policy-check");
    sm.transition("writing");
    sm.transition("committed");
    assert.equal(sm.current(), "committed");
    assert.equal(sm.isTerminal(), true);
  });

  it("rejects illegal transitions", () => {
    const sm = new StateMachine();
    assert.throws(() => sm.transition("committed"), DaemonError);
  });

  it("allows failure from any active state", () => {
    const sm = new StateMachine("reading");
    assert.equal(sm.canTransition("failed"), true);
    sm.transition("failed");
    assert.equal(sm.isTerminal(), true);
  });
});
