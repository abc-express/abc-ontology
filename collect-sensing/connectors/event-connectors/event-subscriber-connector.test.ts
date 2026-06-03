import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  EventSubscriberConnector,
  type EventMessage,
  type EventSubscription,
} from "./event-subscriber-connector.js";

class FakeSubscription implements EventSubscription {
  closed = false;
  pulls: Array<{ max: number; timeoutMs: number }> = [];

  constructor(private readonly batches: EventMessage[][]) {}

  async pull(max: number, timeoutMs: number): Promise<EventMessage[]> {
    this.pulls.push({ max, timeoutMs });
    return this.batches.shift() ?? [];
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

describe("EventSubscriberConnector", () => {
  it("decodes JSON event payloads into raw records", async () => {
    const sub = new FakeSubscription([
      [
        { subject: "orders.created", data: '{"id":"o-1","total":42}' },
        { subject: "orders.created", data: '{"id":"o-2","total":7}' },
      ],
    ]);
    const connector = new EventSubscriberConnector(sub, {
      sourceId: "orders-stream",
      subject: "orders.created",
      recordIdKey: "id",
    });

    const records = await connector.fetch();

    assert.equal(records.length, 2);
    assert.deepEqual(records[0], {
      sourceId: "orders-stream",
      recordId: "o-1",
      payload: { id: "o-1", total: 42 },
    });
    assert.equal(records[1]?.recordId, "o-2");
  });

  it("passes batch size and timeout through to the subscription", async () => {
    const sub = new FakeSubscription([[]]);
    const connector = new EventSubscriberConnector(sub, {
      sourceId: "s",
      subject: "subject",
      batchSize: 25,
      pullTimeoutMs: 1000,
    });

    await connector.fetch();

    assert.deepEqual(sub.pulls[0], { max: 25, timeoutMs: 1000 });
  });

  it("returns an empty batch when no messages are buffered", async () => {
    const sub = new FakeSubscription([]);
    const connector = new EventSubscriberConnector(sub, {
      sourceId: "s",
      subject: "subject",
    });

    assert.deepEqual(await connector.fetch(), []);
  });

  it("rejects non-object payloads", async () => {
    const sub = new FakeSubscription([
      [{ subject: "bad", data: "[1,2,3]" }],
    ]);
    const connector = new EventSubscriberConnector(sub, {
      sourceId: "s",
      subject: "bad",
    });

    await assert.rejects(() => connector.fetch(), /not an object/);
  });

  it("closes the underlying subscription", async () => {
    const sub = new FakeSubscription([]);
    const connector = new EventSubscriberConnector(sub, {
      sourceId: "s",
      subject: "subject",
    });

    await connector.close();

    assert.equal(sub.closed, true);
  });
});
