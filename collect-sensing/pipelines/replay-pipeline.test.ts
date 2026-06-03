import { test } from "node:test";
import assert from "node:assert/strict";
import { ReplayPipeline } from "./replay-pipeline.ts";

test("ReplayPipeline replays events in order with their index", async () => {
  const pipeline = new ReplayPipeline();
  const order: Array<[string, number]> = [];
  await pipeline.replay(["a", "b", "c"], async (e, i) => { order.push([e, i]); });
  assert.deepEqual(order, [["a", 0], ["b", 1], ["c", 2]]);
});

test("ReplayPipeline on an empty event list invokes no handler", async () => {
  const pipeline = new ReplayPipeline();
  let calls = 0;
  await pipeline.replay<string>([], async () => { calls++; });
  assert.equal(calls, 0);
});
