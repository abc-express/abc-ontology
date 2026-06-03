import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OutboundAdapter } from "./outbound-adapter.js";
import { OutboundPolicy } from "./outbound-policy.js";
import { ExternalCommandBus } from "./external-command-bus.js";

describe("OutboundAdapter", () => {
  it("dispatches authorized writes onto the bus", () => {
    const bus = new ExternalCommandBus();
    const adapter = new OutboundAdapter(
      new OutboundPolicy({ allowedSystems: ["erp"] }),
      bus,
    );

    const result = adapter.dispatch({
      system: "erp",
      operation: "upsert",
      payload: { id: 1 },
    });

    assert.equal(result.dispatched, true);
    const pending = adapter.pending();
    assert.equal(pending.length, 1);
    assert.equal(pending[0].target, "erp:upsert");
  });

  it("does not enqueue unauthorized writes", () => {
    const bus = new ExternalCommandBus();
    const adapter = new OutboundAdapter(
      new OutboundPolicy({ allowedSystems: ["erp"] }),
      bus,
    );

    const result = adapter.dispatch({
      system: "crm",
      operation: "upsert",
      payload: {},
    });

    assert.equal(result.dispatched, false);
    assert.equal(adapter.pending().length, 0);
  });
});
