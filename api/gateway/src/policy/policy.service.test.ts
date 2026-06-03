import { test } from "node:test";
import assert from "node:assert/strict";
import { PolicyService } from "./policy.service";

test("allows read on entity by dev default", async () => {
  const decision = await new PolicyService().check("read", "entity");
  assert.equal(decision.effect, "allow");
});

test("allows write on entity by dev default", async () => {
  const decision = await new PolicyService().check("write", "entity");
  assert.equal(decision.effect, "allow");
});

test("allows ingest on ingest resources", async () => {
  const decision = await new PolicyService().check("ingest", "ingest:jobs");
  assert.equal(decision.effect, "allow");
});

test("denies an unknown action/resource pair", async () => {
  const decision = await new PolicyService().check("delete", "secret");
  assert.equal(decision.effect, "deny");
});

test("falls back to dev default when policy engine is unreachable", async () => {
  const prev = process.env.POLICY_ENGINE_URL;
  process.env.POLICY_ENGINE_URL = "http://127.0.0.1:1";
  try {
    const decision = await new PolicyService().check("write", "entity");
    assert.equal(decision.effect, "allow");
    assert.equal(decision.reason, "dev-default");
  } finally {
    if (prev === undefined) delete process.env.POLICY_ENGINE_URL;
    else process.env.POLICY_ENGINE_URL = prev;
  }
});
