import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  globalHttpMetrics,
  normalizeRoutePath,
} from "@daemon/observability/metrics/http-metrics.js";

describe("observability integration", () => {
  it("normalizeRoutePath matches gateway entity routes", () => {
    assert.equal(
      normalizeRoutePath("/v1/read/entities/abc-123"),
      "/v1/read/entities/:entityId",
    );
  });

  it("globalHttpMetrics exposes prometheus after record", () => {
    const before = globalHttpMetrics.prometheusText();
    globalHttpMetrics.recordRequest(
      { method: "GET", route: "/test-obs", status: "200" },
      1,
    );
    const after = globalHttpMetrics.prometheusText();
    assert.notEqual(before, after);
    assert.match(after, /route="\/test-obs"/);
  });
});
