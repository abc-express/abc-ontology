import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CompensationHandler } from "./compensation-handler.js";

describe("CompensationHandler", () => {
  it("compensates in reverse (LIFO) order", async () => {
    const handler = new CompensationHandler();
    const order: string[] = [];
    handler.record({ id: "a", compensate: () => void order.push("a") });
    handler.record({ id: "b", compensate: () => void order.push("b") });
    handler.record({ id: "c", compensate: () => void order.push("c") });
    const outcomes = await handler.rollback();
    assert.deepEqual(order, ["c", "b", "a"]);
    assert.equal(outcomes.every((o) => o.ok), true);
    assert.equal(handler.pendingCount(), 0);
  });

  it("continues past a failing compensation and reports it", async () => {
    const handler = new CompensationHandler();
    const order: string[] = [];
    handler.record({ id: "a", compensate: () => void order.push("a") });
    handler.record({
      id: "b",
      compensate: () => {
        throw new Error("cleanup failed");
      },
    });
    const outcomes = await handler.rollback();
    assert.deepEqual(order, ["a"]);
    const failed = outcomes.find((o) => o.id === "b");
    assert.equal(failed?.ok, false);
    assert.equal(failed?.error, "cleanup failed");
  });
});
