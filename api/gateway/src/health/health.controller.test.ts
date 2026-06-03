import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HealthController } from "./health.controller.js";

describe("HealthController", () => {
  it("returns ok status", () => {
    const controller = new HealthController();
    assert.deepEqual(controller.health(), { status: "ok" });
  });
});
