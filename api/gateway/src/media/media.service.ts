import { createHash, randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { TenantContextHeaders } from "../platform/tenant-context";

export interface MediaObjectRow {
  id: string;
  uri: string;
  checksum?: string;
  mimeType?: string;
  sizeBytes?: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

@Injectable()
export class MediaService {
  private async getPg() {
    const { PostgresClient } = await import(
      "@daemon/data-platform/operational-store"
    );
    return new PostgresClient({
      connectionString: process.env.DAEMON_POSTGRES_URL!,
    });
  }

  async register(
    ctx: TenantContextHeaders,
    input: {
      uri: string;
      checksum?: string;
      mimeType?: string;
      sizeBytes?: number;
      metadata?: Record<string, unknown>;
    },
  ): Promise<MediaObjectRow> {
    if (!process.env.DAEMON_POSTGRES_URL) {
      throw new Error("DAEMON_POSTGRES_URL required for media objects");
    }
    const id = `media-${randomUUID()}`;
    const pg = await this.getPg();
    try {
      await pg.query(
        `INSERT INTO daemon_media_objects
         (id, tenant_id, domain_id, uri, checksum, mime_type, size_bytes, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
        [
          id,
          ctx.tenantId,
          ctx.domainId,
          input.uri,
          input.checksum ?? null,
          input.mimeType ?? null,
          input.sizeBytes ?? null,
          JSON.stringify(input.metadata ?? {}),
        ],
      );
      return {
        id,
        uri: input.uri,
        checksum: input.checksum,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        metadata: input.metadata,
        createdAt: new Date().toISOString(),
      };
    } finally {
      await pg.close();
    }
  }

  async list(ctx: TenantContextHeaders, limit = 50): Promise<MediaObjectRow[]> {
    if (!process.env.DAEMON_POSTGRES_URL) return [];
    const pg = await this.getPg();
    try {
      const res = await pg.query<{
        id: string;
        uri: string;
        checksum: string | null;
        mime_type: string | null;
        size_bytes: string | null;
        metadata: Record<string, unknown>;
        created_at: Date;
      }>(
        `SELECT id, uri, checksum, mime_type, size_bytes, metadata, created_at
         FROM daemon_media_objects
         WHERE tenant_id = $1 AND domain_id = $2
         ORDER BY created_at DESC LIMIT $3`,
        [ctx.tenantId, ctx.domainId, limit],
      );
      return res.rows.map((r) => ({
        id: r.id,
        uri: r.uri,
        checksum: r.checksum ?? undefined,
        mimeType: r.mime_type ?? undefined,
        sizeBytes: r.size_bytes ? Number(r.size_bytes) : undefined,
        metadata: r.metadata,
        createdAt: r.created_at.toISOString(),
      }));
    } finally {
      await pg.close();
    }
  }

  /** MVP: accept base64 body and store as data: URI with checksum. */
  async uploadInline(
    ctx: TenantContextHeaders,
    body: { contentBase64: string; mimeType?: string; fileName?: string },
  ): Promise<MediaObjectRow> {
    const buf = Buffer.from(body.contentBase64, "base64");
    const checksum = createHash("sha256").update(buf).digest("hex");
    const uri = `data:${body.mimeType ?? "application/octet-stream"};name=${encodeURIComponent(body.fileName ?? "upload")};checksum=${checksum}`;
    return this.register(ctx, {
      uri,
      checksum,
      mimeType: body.mimeType,
      sizeBytes: buf.length,
      metadata: { fileName: body.fileName },
    });
  }
}
