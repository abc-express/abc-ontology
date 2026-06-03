import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DaemonError } from "@daemon/platform-types";
import { ComplianceExport } from "./compliance-export.js";
import type { AuditEntry } from "./audit-log.js";

const entries: AuditEntry[] = [
  { id: "1", at: "2026-01-01T00:00:00.000Z", action: "read", subjectId: "u1", resource: "r", outcome: "allow" },
  { id: "2", at: "2026-01-02T00:00:00.000Z", action: "write", subjectId: "u1", resource: "r", outcome: "deny" },
  { id: "3", at: "2026-02-01T00:00:00.000Z", action: "read", subjectId: "u2", resource: "r", outcome: "allow" },
];

describe("ComplianceExport", () => {
  const exporter = new ComplianceExport();

  it("summarizes outcomes within a window", () => {
    const report = exporter.report(entries, {
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-01-31T23:59:59.999Z",
    });
    assert.equal(report.total, 2);
    assert.equal(report.allowed, 1);
    assert.equal(report.denied, 1);
  });

  it("serializes to JSONL", () => {
    const report = exporter.report(entries, {
      from: "2026-02-01T00:00:00.000Z",
      to: "2026-02-28T00:00:00.000Z",
    });
    const lines = exporter.toJsonl(report).split("\n");
    assert.equal(lines.length, 1);
    assert.equal(JSON.parse(lines[0]).id, "3");
  });

  it("rejects inverted windows", () => {
    assert.throws(
      () => exporter.report(entries, { from: "2026-02-01", to: "2026-01-01" }),
      (err) => err instanceof DaemonError && err.code === "VALIDATION",
    );
  });
});
