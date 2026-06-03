import { test } from "node:test";
import assert from "node:assert/strict";
import { StreamPipeline } from "./stream-pipeline.ts";

test("StreamPipeline fans an emitted item out to every handler", async () => {
  const pipeline = new StreamPipeline<number>();
  const seen: number[] = [];
  pipeline.on(async (n) => { seen.push(n); });
  pipeline.on(async (n) => { seen.push(n * 10); });
  await pipeline.emit(2);
  assert.deepEqual(seen.sort((a, b) => a - b), [2, 20]);
});

test("StreamPipeline with no handlers resolves without error", async () => {
  const pipeline = new StreamPipeline<string>();
  await pipeline.emit("noop");
  assert.ok(true);
});
