import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  HttpPullConnector,
  type HttpFetch,
} from "./http-pull-connector.js";

function fetchReturning(body: unknown, ok = true, status = 200): {
  fn: HttpFetch;
  calls: Array<{ url: string; headers?: Record<string, string> }>;
} {
  const calls: Array<{ url: string; headers?: Record<string, string> }> = [];
  const fn: HttpFetch = async (url, init) => {
    calls.push(init?.headers ? { url, headers: init.headers } : { url });
    return { ok, status, json: async () => body };
  };
  return { fn, calls };
}

describe("HttpPullConnector", () => {
  it("pulls an envelope array, applies headers, and maps records", async () => {
    const { fn, calls } = fetchReturning({
      data: [
        { uid: "1", name: "a" },
        { uid: "2", name: "b" },
      ],
    });
    const connector = new HttpPullConnector(fn, {
      sourceId: "crm",
      url: "https://example.test/customers",
      headers: { authorization: "Bearer t" },
      itemsKey: "data",
      recordIdKey: "uid",
    });

    assert.equal(connector.kind, "api");
    const records = await connector.fetch();

    assert.deepEqual(calls, [
      { url: "https://example.test/customers", headers: { authorization: "Bearer t" } },
    ]);
    assert.equal(records.length, 2);
    assert.equal(records[0]?.recordId, "1");
    assert.equal(records[0]?.sourceId, "crm");
    assert.deepEqual(records[1]?.payload, { uid: "2", name: "b" });
  });

  it("accepts a bare top-level array", async () => {
    const { fn } = fetchReturning([{ id: "x" }]);
    const connector = new HttpPullConnector(fn, {
      sourceId: "s",
      url: "https://example.test/x",
    });
    const records = await connector.fetch();
    assert.equal(records.length, 1);
    assert.equal(records[0]?.recordId, "x");
  });

  it("throws on non-2xx responses", async () => {
    const { fn } = fetchReturning([], false, 503);
    const connector = new HttpPullConnector(fn, {
      sourceId: "s",
      url: "https://example.test/down",
    });
    await assert.rejects(() => connector.fetch(), /-> 503/);
  });

  it("throws when the body is not an array", async () => {
    const { fn } = fetchReturning({ nope: true });
    const connector = new HttpPullConnector(fn, {
      sourceId: "s",
      url: "https://example.test/bad",
    });
    await assert.rejects(() => connector.fetch(), /JSON array/);
  });
});
