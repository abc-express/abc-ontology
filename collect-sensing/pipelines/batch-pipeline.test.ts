import { test } from "node:test";
import assert from "node:assert/strict";
import { BatchPipeline } from "./batch-pipeline.ts";

test("BatchPipeline processes every item and returns the count", async () => {
  const pipeline = new BatchPipeline();
  const seen: number[] = [];
  const n = await pipeline.process([1, 2, 3], async (item) => { seen.push(item); });
  assert.equal(n, 3);
  assert.deepEqual(seen, [1, 2, 3]);
});

test("BatchPipeline returns zero for an empty batch", async () => {
  const pipeline = new BatchPipeline();
  const n = await pipeline.process<number>([], async () => {});
  assert.equal(n, 0);
});
