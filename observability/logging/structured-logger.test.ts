import { test } from "node:test";
import assert from "node:assert/strict";
import { StructuredLogger } from "./structured-logger.js";

test("structured logger emits JSON with service and level", () => {
  const lines: string[] = [];
  const logger = new StructuredLogger({
    service: "test-svc",
    minLevel: "info",
    sink: (line) => lines.push(line),
  });
  logger.debug("hidden");
  logger.info("hello", { requestId: "r1" });
  assert.equal(lines.length, 1);
  const parsed = JSON.parse(lines[0]!) as {
    level: string;
    message: string;
    service: string;
    requestId: string;
  };
  assert.equal(parsed.level, "info");
  assert.equal(parsed.message, "hello");
  assert.equal(parsed.service, "test-svc");
  assert.equal(parsed.requestId, "r1");
});
