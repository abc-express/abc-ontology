/** Spec: collect-sensing/connectors/file-connectors/file-ingest-connector.ts */
import {
  type RawRecord,
  type SourceConnector,
  toRawRecords,
} from "../connector.js";

export type FileFormat = "jsonl" | "csv";

export interface FileIngestConnectorConfig {
  readonly sourceId: string;
  readonly format: FileFormat;
  /** Field used as the per-record id, when present. */
  readonly recordIdKey?: string;
  /** Delimiter for CSV input. Defaults to ",". */
  readonly delimiter?: string;
}

/** Parse a single CSV line honoring simple double-quote escaping. */
function parseCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      out.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out;
}

function parseJsonl(content: string): Record<string, unknown>[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line, index) => {
      const value = JSON.parse(line) as unknown;
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error(`jsonl line ${index + 1} is not an object`);
      }
      return value as Record<string, unknown>;
    });
}

function parseCsv(content: string, delimiter: string): Record<string, unknown>[] {
  const lines = content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return [];
  }
  const header = parseCsvLine(lines[0]!, delimiter);
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line, delimiter);
    const row: Record<string, unknown> = {};
    header.forEach((key, idx) => {
      row[key] = cells[idx] ?? "";
    });
    return row;
  });
}

/**
 * Connector that turns the contents of a JSONL or CSV document into
 * {@link RawRecord}s. Content is supplied by the caller so the connector stays
 * free of filesystem coupling and is unit-testable.
 */
export class FileIngestConnector implements SourceConnector {
  readonly kind = "file";
  readonly sourceId: string;

  constructor(private readonly config: FileIngestConnectorConfig) {
    this.sourceId = config.sourceId;
  }

  parse(content: string): RawRecord[] {
    const rows =
      this.config.format === "jsonl"
        ? parseJsonl(content)
        : parseCsv(content, this.config.delimiter ?? ",");
    return toRawRecords(this.sourceId, rows, this.config.recordIdKey ?? "id");
  }

  /**
   * Returns records for the most recently {@link parse}d content. A pipeline
   * typically calls {@link parse} directly with freshly read bytes; this exists
   * to satisfy {@link SourceConnector} when wired through the orchestrator.
   */
  async fetch(): Promise<RawRecord[]> {
    if (this.pending === undefined) {
      throw new Error("file-ingest-connector: call parse(content) before fetch()");
    }
    return this.pending;
  }

  /** Stage content so a later {@link fetch} returns its records. */
  stage(content: string): this {
    this.pending = this.parse(content);
    return this;
  }

  private pending: RawRecord[] | undefined;
}
