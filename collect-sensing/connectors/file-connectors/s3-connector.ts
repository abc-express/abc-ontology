import type { RawRecord, SourceConnector } from "../connector.js";
import { toRawRecords } from "../connector.js";

export interface S3ConnectorConfig {
  readonly sourceId: string;
  readonly bucket: string;
  readonly prefix?: string;
  readonly region?: string;
  readonly format: "jsonl" | "csv";
  /** Explicit object keys when ListObjects is unavailable */
  readonly keys?: readonly string[];
  readonly recordIdKey?: string;
  readonly endpoint?: string;
}

async function loadAwsS3(): Promise<typeof import("@aws-sdk/client-s3")> {
  try {
    return await import("@aws-sdk/client-s3");
  } catch {
    throw new Error(
      "s3 connector requires @aws-sdk/client-s3 (pnpm add @aws-sdk/client-s3 in collect-sensing)",
    );
  }
}

function parseJsonl(text: string): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const row = JSON.parse(trimmed) as unknown;
    if (typeof row === "object" && row !== null && !Array.isArray(row)) {
      rows.push(row as Record<string, unknown>);
    }
  }
  return rows;
}

function parseCsv(text: string): Record<string, unknown>[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0]!.split(",").map((h) => h.trim());
  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]!.split(",");
    const row: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx]?.trim() ?? "";
    });
    rows.push(row);
  }
  return rows;
}

export class S3Connector implements SourceConnector {
  readonly kind = "file";
  readonly sourceId: string;

  constructor(private readonly config: S3ConnectorConfig) {
    this.sourceId = config.sourceId;
  }

  async fetch(): Promise<RawRecord[]> {
    const { S3Client, GetObjectCommand, ListObjectsV2Command } =
      await loadAwsS3();
    const client = new S3Client({
      region: this.config.region ?? process.env.AWS_REGION ?? "us-east-1",
      endpoint: this.config.endpoint,
      forcePathStyle: Boolean(this.config.endpoint),
    });
    const keys: string[] = [...(this.config.keys ?? [])];
    if (keys.length === 0) {
      const list = await client.send(
        new ListObjectsV2Command({
          Bucket: this.config.bucket,
          Prefix: this.config.prefix,
        }),
      );
      for (const item of list.Contents ?? []) {
        if (item.Key) keys.push(item.Key);
      }
    }
    const allRows: Record<string, unknown>[] = [];
    for (const key of keys) {
      const res = await client.send(
        new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
      );
      const body = await res.Body?.transformToString("utf8");
      if (!body) continue;
      const parsed =
        this.config.format === "jsonl" ? parseJsonl(body) : parseCsv(body);
      allRows.push(...parsed);
    }
    return toRawRecords(this.sourceId, allRows, this.config.recordIdKey);
  }
}
