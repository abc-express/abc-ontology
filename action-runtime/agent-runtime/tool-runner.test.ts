import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DaemonError } from "@daemon/platform-types";
import { ToolRunner } from "./tool-runner.js";

describe("ToolRunner", () => {
  it("runs a registered tool", async () => {
    const runner = new ToolRunner();
    runner.register<{ a: number; b: number }, number>({
      name: "add",
      required: ["a", "b"],
      handler: ({ a, b }) => a + b,
    });
    const result = await runner.run("add", { a: 2, b: 3 });
    assert.equal(result.ok, true);
    assert.equal(result.output, 5);
  });

  it("reports missing required inputs without throwing", async () => {
    const runner = new ToolRunner();
    runner.register({ name: "greet", required: ["name"], handler: () => "hi" });
    const result = await runner.run("greet", {});
    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /missing inputs: name/);
  });

  it("captures handler errors as structured results", async () => {
    const runner = new ToolRunner();
    runner.register({
      name: "boom",
      required: [],
      handler: () => {
        throw new Error("kaboom");
      },
    });
    const result = await runner.run("boom", {});
    assert.equal(result.ok, false);
    assert.equal(result.error, "kaboom");
  });

  it("rejects duplicate registration and unknown tools", async () => {
    const runner = new ToolRunner();
    runner.register({ name: "x", required: [], handler: () => 1 });
    assert.throws(
      () => runner.register({ name: "x", required: [], handler: () => 2 }),
      (err) => err instanceof DaemonError && err.code === "CONFLICT",
    );
    await assert.rejects(
      () => runner.run("missing", {}),
      (err) => err instanceof DaemonError && err.code === "NOT_FOUND",
    );
  });
});
