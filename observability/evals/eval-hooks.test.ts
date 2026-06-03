import { test } from "node:test";
import assert from "node:assert/strict";
import { EvalRecorder } from "./eval-hooks.js";

test("eval recorder tracks pass rate", () => {
  const recorder = new EvalRecorder();
  recorder.record({ name: "tool-accuracy", score: 0.9 });
  recorder.record({ name: "hallucination", score: 0.4, threshold: 0.8 });
  assert.equal(recorder.list().length, 2);
  assert.equal(recorder.passRate(), 0.5);
  assert.ok(recorder.exportJsonl().includes("tool-accuracy"));
});
