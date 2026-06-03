import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DaemonError } from "@daemon/platform-types";
import {
  ConstraintEngine,
  range,
  required,
} from "./constraint-engine.js";

describe("ConstraintEngine", () => {
  it("passes when all constraints are satisfied", () => {
    const engine = new ConstraintEngine();
    engine.define("name", required("name"));
    engine.define("age", range("age", 0, 120));
    const result = engine.check({ name: "ada", age: 36 });
    assert.equal(result.valid, true);
    assert.equal(result.violations.length, 0);
  });

  it("collects all violations", () => {
    const engine = new ConstraintEngine();
    engine.define("name", required("name"));
    engine.define("age", range("age", 0, 120));
    const result = engine.check({ age: 999 });
    assert.equal(result.valid, false);
    assert.equal(result.violations.length, 2);
  });

  it("throws on assert when invalid", () => {
    const engine = new ConstraintEngine();
    engine.define("name", required("name"));
    assert.throws(() => engine.assert({}), DaemonError);
  });
});
