import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DaemonError } from "@daemon/platform-types";
import { Evaluator } from "./evaluator.js";

interface Answer {
  length: number;
  cited: boolean;
}

describe("Evaluator", () => {
  const evaluator = new Evaluator(
    [
      { name: "length", weight: 1, score: (c) => ((c as Answer).length > 50 ? 1 : 0) },
      { name: "cited", weight: 3, score: (c) => ((c as Answer).cited ? 1 : 0) },
    ],
    0.7,
  );

  it("passes when weighted score clears the threshold", () => {
    const result = evaluator.evaluate({ length: 100, cited: true });
    assert.equal(result.score, 1);
    assert.equal(result.passed, true);
  });

  it("fails when high-weight criteria miss", () => {
    const result = evaluator.evaluate({ length: 100, cited: false });
    assert.equal(result.passed, false);
    assert.equal(result.breakdown.cited, 0);
  });

  it("rejects degenerate configurations", () => {
    assert.throws(
      () => new Evaluator([]),
      (err) => err instanceof DaemonError && err.code === "VALIDATION",
    );
  });
});
