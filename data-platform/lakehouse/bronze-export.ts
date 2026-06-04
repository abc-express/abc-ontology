import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export interface BronzeExportOptions {
  readonly connectionString: string;
  readonly tenantId: string;
  readonly domainId: string;
  readonly since?: string;
  readonly limit?: number;
  readonly bucket: string;
  readonly keyPrefix: string;
  readonly endpoint?: string;
  readonly region?: string;
}

export interface BronzeExportResult {
  readonly objectKey: string;
  readonly rowCount: number;
  readonly format: "jsonl";
}

/**
 * Exports bronze journal rows to object storage as newline-delimited JSON (export v1).
 * Iceberg/Parquet catalog integration is a follow-on; this path is real and testable on MinIO.
 */
export async function exportBronzeToObjectStore(
  options: BronzeExportOptions,
): Promise<BronzeExportResult> {
  const { PostgresClient } = await import("../operational-store/postgres-client.js");
  const client = new PostgresClient({ connectionString: options.connectionString });
  const params: unknown[] = [options.tenantId, options.domainId];
  let sql = `SELECT entity_id, entity_type, ontology_id, change_type, payload, recorded_at
             FROM daemon_bronze_events
             WHERE tenant_id = $1 AND domain_id = $2`;
  if (options.since) {
    params.push(options.since);
    sql += ` AND recorded_at >= $${params.length}::timestamptz`;
  }
  sql += ` ORDER BY recorded_at ASC`;
  const limit = options.limit ?? 5000;
  params.push(limit);
  sql += ` LIMIT $${params.length}`;

  const { rows } = await client.query<Record<string, unknown>>(sql, params);
  const lines = rows.map((r) => JSON.stringify(r)).join("\n");
  const objectKey = `${options.keyPrefix.replace(/\/+$/, "")}/bronze-${Date.now()}.jsonl`;

  const s3 = new S3Client({
    region: options.region ?? "us-east-1",
    endpoint: options.endpoint,
    forcePathStyle: Boolean(options.endpoint),
  });
  await s3.send(
    new PutObjectCommand({
      Bucket: options.bucket,
      Key: objectKey,
      Body: lines,
      ContentType: "application/x-ndjson",
    }),
  );

  return { objectKey, rowCount: rows.length, format: "jsonl" };
}
