import type { EntityRecord } from "@daemon/ontology";
import type { ProductRuntime } from "../shared/product-runtime.js";

export interface ReportRow {
  entityId: string;
  ontologyId: string;
  version: number;
  properties: Record<string, unknown>;
}

export interface AnalyticsReport {
  title: string;
  rowCount: number;
  rows: ReportRow[];
  generatedAt: string;
  /** Distinct property keys across all rows (for column pickers). */
  columns: string[];
}

/**
 * Builds a tabular report from ontology entity records for export or UI display.
 */
export class ReportGenerator {
  constructor(private readonly runtime: ProductRuntime) {}

  generate(title: string, records: EntityRecord[]): AnalyticsReport {
    this.runtime.assertAllowed("query", "analytics");
    const rows: ReportRow[] = records.map((record) => ({
      entityId: record.entityId,
      ontologyId: record.ontologyId,
      version: record.version,
      properties: { ...record.properties },
    }));
    const columnSet = new Set<string>();
    for (const row of rows) {
      for (const key of Object.keys(row.properties)) {
        columnSet.add(key);
      }
    }
    return {
      title,
      rowCount: rows.length,
      rows,
      generatedAt: new Date().toISOString(),
      columns: [...columnSet].sort(),
    };
  }

  /** RFC4180-style CSV with fixed leading columns plus dynamic property keys. */
  toCsv(report: AnalyticsReport): string {
    const headers = [
      "entityId",
      "ontologyId",
      "version",
      ...report.columns,
    ];
    const lines = [headers.join(",")];
    for (const row of report.rows) {
      const cells = [
        row.entityId,
        row.ontologyId,
        String(row.version),
        ...report.columns.map((col) => escapeCsvCell(row.properties[col])),
      ];
      lines.push(cells.join(","));
    }
    return lines.join("\n");
  }
}

function escapeCsvCell(value: unknown): string {
  const text =
    value === null || value === undefined
      ? ""
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}
