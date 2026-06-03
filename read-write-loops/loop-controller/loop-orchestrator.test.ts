import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  DaemonSession,
  EntityId,
  OntologyId,
  PolicyDecision,
} from "@daemon/platform-types";
import { DaemonError } from "@daemon/platform-types";
import {
  LoopOrchestrator,
  type OutboundPort,
  type PolicyPort,
  type ReadPort,
  type WritePort,
} from "./loop-orchestrator.js";

const session: DaemonSession = {
  sessionId: "s1" as DaemonSession["sessionId"],
  subjectId: "user-1",
  tenantId: "tenant-1",
  roles: ["editor"],
  issuedAt: new Date().toISOString(),
};

const req = {
  session,
  ontologyId: "ont" as OntologyId,
  entityId: "ent" as EntityId,
  patch: { name: "updated" },
};

const reads: ReadPort = {
  route: () => ({ id: "ent", name: "before" }),
};

const allowPolicy: PolicyPort = {
  evaluate: (): PolicyDecision => ({ effect: "allow" }),
};

const denyPolicy: PolicyPort = {
  evaluate: (): PolicyDecision => ({ effect: "deny", reason: "no-grant" }),
};

const writes: WritePort = {
  submit: () => ({ writeId: "w1", status: "committed", version: 7 }),
};

describe("LoopOrchestrator", () => {
  it("runs read → policy → write to committed", () => {
    const orch = new LoopOrchestrator(reads, allowPolicy, writes);
    const outcome = orch.run(req);
    assert.equal(outcome.state, "committed");
    assert.equal(outcome.version, 7);
    assert.equal(outcome.externalDispatched, false);
    assert.deepEqual(outcome.trace, [
      "reading",
      "policy-check",
      "writing",
      "committed",
    ]);
  });

  it("dispatches the external write when configured", () => {
    const dispatched: string[] = [];
    const outbound: OutboundPort = {
      dispatch: (w) => {
        dispatched.push(`${w.system}:${w.operation}`);
        return { dispatched: true, reason: "ok" };
      },
    };
    const orch = new LoopOrchestrator(reads, allowPolicy, writes, outbound);
    const outcome = orch.run({
      ...req,
      external: { system: "erp", operation: "upsert" },
    });
    assert.equal(outcome.externalDispatched, true);
    assert.deepEqual(dispatched, ["erp:upsert"]);
    assert.ok(outcome.trace.includes("external-write"));
  });

  it("fails the loop when policy denies the write", () => {
    const orch = new LoopOrchestrator(reads, denyPolicy, writes);
    assert.throws(() => orch.run(req), (err: unknown) => {
      assert.ok(err instanceof DaemonError);
      assert.equal(err.code, "POLICY_DENIED");
      return true;
    });
  });
});
