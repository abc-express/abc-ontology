import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NatsEventPublisher } from "./nats-publisher.js";

describe("NatsEventPublisher", () => {
  it("publish without NATS returns envelope", async () => {
    const bus = new NatsEventPublisher({});
    assert.equal(bus.enabled(), false);
    const env = await bus.publish("entity.updated", { id: "1" });
    assert.equal(env.topic, "entity.updated");
    assert.equal(env.payload.id, "1");
  });
});
