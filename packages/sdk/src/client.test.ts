import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DaemonClient } from "./client.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("DaemonClient", () => {
  it("calls health endpoint", async () => {
    const client = new DaemonClient({
      baseUrl: "http://example.test",
      fetch: async () => jsonResponse({ status: "ok" }),
    });
    const h = await client.health();
    assert.deepEqual(h, { status: "ok" });
  });

  it("readEntity uses gateway read path", async () => {
    let url = "";
    const client = new DaemonClient({
      baseUrl: "http://example.test",
      fetch: async (input) => {
        url = String(input);
        return jsonResponse({
          entityId: "e1",
          ontologyId: "foundation",
          properties: { name: "x" },
          version: 1,
          updatedAt: "2020-01-01T00:00:00.000Z",
        });
      },
    });
    const rec = await client.readEntity("e1", "foundation");
    assert.match(url, /\/v1\/read\/entities\/e1\?ontologyId=foundation/);
    assert.equal(rec.entityId, "e1");
  });

  it("listEntities passes query params", async () => {
    let url = "";
    const client = new DaemonClient({
      baseUrl: "http://example.test",
      fetch: async (input) => {
        url = String(input);
        return jsonResponse({ items: [], nextCursor: null });
      },
    });
    await client.listEntities({
      ontologyId: "foundation",
      entityType: "Party",
      limit: 10,
      cursor: "abc",
    });
    assert.match(url, /ontologyId=foundation/);
    assert.match(url, /entityType=Party/);
    assert.match(url, /limit=10/);
    assert.match(url, /cursor=abc/);
  });

  it("search builds query string", async () => {
    let url = "";
    const client = new DaemonClient({
      baseUrl: "http://example.test",
      fetch: async (input) => {
        url = String(input);
        return jsonResponse({ hits: [], count: 0 });
      },
    });
    await client.search({ q: "hello", ontologyId: "foundation", mode: "hybrid" });
    assert.match(url, /\/v1\/search\?/);
    assert.match(url, /q=hello/);
    assert.match(url, /mode=hybrid/);
  });

  it("lakehouseSummary hits summary route", async () => {
    let url = "";
    const client = new DaemonClient({
      baseUrl: "http://example.test",
      fetch: async (input) => {
        url = String(input);
        return jsonResponse({
          entityTypeCounts: [],
          changeVolumeByDay: [],
          window: {},
        });
      },
    });
    await client.lakehouseSummary();
    assert.match(url, /\/v1\/lakehouse\/summary$/);
  });

  it("lakehouseSummary appends since query param", async () => {
    let url = "";
    const client = new DaemonClient({
      baseUrl: "http://example.test",
      fetch: async (input) => {
        url = String(input);
        return jsonResponse({
          entityTypeCounts: [],
          changeVolumeByDay: [],
          window: { since: "2024-01-01T00:00:00.000Z" },
        });
      },
    });
    await client.lakehouseSummary({ since: "2024-01-01T00:00:00.000Z" });
    assert.match(url, /\/v1\/lakehouse\/summary\?/);
    assert.match(url, /since=2024-01-01/);
  });

  it("lakehouseEvents builds full query string", async () => {
    let url = "";
    const client = new DaemonClient({
      baseUrl: "http://example.test",
      fetch: async (input) => {
        url = String(input);
        return jsonResponse([]);
      },
    });
    await client.lakehouseEvents({
      since: "2024-01-01T00:00:00.000Z",
      limit: 50,
      entityType: "Party",
      ontologyId: "foundation",
      changeType: "register",
    });
    assert.match(url, /\/v1\/lakehouse\/events\?/);
    assert.match(url, /since=2024-01-01/);
    assert.match(url, /limit=50/);
    assert.match(url, /entityType=Party/);
    assert.match(url, /ontologyId=foundation/);
    assert.match(url, /changeType=register/);
  });

  it("analyticsLakehouseSummary hits analytics route", async () => {
    let url = "";
    const client = new DaemonClient({
      baseUrl: "http://example.test",
      fetch: async (input) => {
        url = String(input);
        return jsonResponse({
          title: "Lakehouse report",
          generatedAt: "2024-06-01T00:00:00.000Z",
          totalEvents: 3,
          summary: {
            entityTypeCounts: [],
            changeVolumeByDay: [],
            window: {},
          },
        });
      },
    });
    const report = await client.analyticsLakehouseSummary({
      since: "2024-01-01T00:00:00.000Z",
      reportTitle: "Weekly",
    });
    assert.match(url, /\/v1\/analytics\/lakehouse-summary\?/);
    assert.match(url, /since=2024-01-01/);
    assert.match(url, /reportTitle=Weekly/);
    assert.equal(report.totalEvents, 3);
  });

  it("ingestRecords posts body", async () => {
    let init: RequestInit | undefined;
    const client = new DaemonClient({
      baseUrl: "http://example.test",
      fetch: async (_input, options) => {
        init = options;
        return jsonResponse({ accepted: 1 });
      },
    });
    await client.ingestRecords({
      ontologyId: "foundation",
      records: [{ ontologyId: "foundation", entityId: "e1" }],
    });
    assert.equal(init?.method, "POST");
    const body = JSON.parse(String(init?.body)) as { records: unknown[] };
    assert.equal(body.records.length, 1);
  });

  it("customerGptChat forwards session header", async () => {
    let headers: HeadersInit | undefined;
    const client = new DaemonClient({
      baseUrl: "http://example.test",
      fetch: async (_input, options) => {
        headers = options?.headers;
        return jsonResponse({ reply: "hi" });
      },
    });
    await client.customerGptChat(
      { turns: [{ role: "user", content: "hi" }] },
      "sess-1",
    );
    const h = headers as Record<string, string>;
    assert.equal(h["x-session-id"], "sess-1");
  });

  it("shadowPricingSimulate posts to products route", async () => {
    let url = "";
    let body = "";
    const client = new DaemonClient({
      baseUrl: "http://example.test",
      fetch: async (input, options) => {
        url = String(input);
        body = String(options?.body ?? "");
        return jsonResponse({
          mode: "ontology-only",
          generatedAt: "2020-01-01T00:00:00.000Z",
          routingDecisions: { count: 0, items: [] },
          shipments: { count: 1, items: [{ entityId: "s1" }] },
          readOnly: true,
        });
      },
    });
    const result = await client.shadowPricingSimulate({
      ontologyId: "foundation",
      shipmentRef: "SHP-ABC-001",
    });
    assert.match(url, /\/v1\/products\/shadow-pricing\/simulate$/);
    assert.match(body, /SHP-ABC-001/);
    assert.equal(result.readOnly, true);
    assert.equal(result.shipments.count, 1);
  });

  it("sends tenant and domain headers when configured", async () => {
    let headers: HeadersInit | undefined;
    const client = new DaemonClient({
      baseUrl: "http://example.test",
      tenantId: "t1",
      domainId: "d1",
      fetch: async (_input, options) => {
        headers = options?.headers;
        return jsonResponse({ status: "ok" });
      },
    });
    await client.health();
    const h = headers as Record<string, string>;
    assert.equal(h["x-daemon-tenant"], "t1");
    assert.equal(h["x-daemon-domain"], "d1");
  });
});
