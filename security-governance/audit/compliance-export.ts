/** Spec: security-governance/audit/compliance-export.ts */
import { DaemonError, ErrorCodes } from "@daemon/platform-types";
import type { AuditEntry } from "./audit-log.js";

export interface ExportWindow {
  /** Inclusive ISO start timestamp. */
  from: string;
  /** Inclusive ISO end timestamp. */
  to: string;
}

export interface ComplianceReport {
  window: ExportWindow;
  total: number;
  allowed: number;
  denied: number;
  entries: AuditEntry[];
}

/**
 * Produces point-in-time compliance reports from audit entries. Filters a
 * supplied set of entries to a time window and summarizes allow/deny outcomes,
 * and can serialize the result to JSONL for downstream archival.
 */
export class ComplianceExport {
  report(entries: AuditEntry[], window: ExportWindow): ComplianceReport {
    if (window.from > window.to) {
      throw new DaemonError(ErrorCodes.VALIDATION, "from must be <= to", 400);
    }
    const inWindow = entries.filter(
      (e) => e.at >= window.from && e.at <= window.to,
    );
    const denied = inWindow.filter((e) => e.outcome === "deny").length;
    return {
      window,
      total: inWindow.length,
      allowed: inWindow.length - denied,
      denied,
      entries: inWindow,
    };
  }

  /** Serialize a report's entries to newline-delimited JSON. */
  toJsonl(report: ComplianceReport): string {
    return report.entries.map((e) => JSON.stringify(e)).join("\n");
  }
}
