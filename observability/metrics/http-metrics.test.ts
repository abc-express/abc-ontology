import { test } from "node:test";
import assert from "node:assert/strict";
import { HttpMetricsRegistry, normalizeRoutePath } from "./http-metrics.js";

test("records counters and renders prometheus text", () => {
  const registry = new HttpMetricsRegistry();
  registry.recordRequest({ method: "GET", route: "/health", status: "200" }, 3);
  registry.recordRequest({ method: "GET", route: "/health", status: "200" }, 7);
  const text = registry.prometheusText();
  assert.match(text, /daemon_http_requests_total\{method="GET",route="\/health",status="200"\} 2/);
  assert.match(text, /daemon_http_request_duration_ms_sum\{method="GET",route="\/health"\} 10/);
});

test("normalizeRoutePath collapses entity ids", () => {
  assert.equal(
    normalizeRoutePath("/v1/entities/rest-read-1"),
    "/v1/entities/:entityId",
  );
});
