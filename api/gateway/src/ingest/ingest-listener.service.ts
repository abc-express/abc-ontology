import { Injectable } from "@nestjs/common";
import { DaemonError, ErrorCodes } from "@daemon/platform-types";
import type { TenantContextHeaders } from "../platform/tenant-context";
import { IngestWebhookService } from "./ingest-webhook.service";
import type { IngestRecord } from "./ingest.service";

const seenKeys = new Map<string, number>();
const MAX_KEYS = 10_000;

@Injectable()
export class IngestListenerService {
  constructor(private readonly webhooks: IngestWebhookService) {}

  assertIdempotency(listenerId: string, key: string | undefined): void {
    if (!key?.trim()) return;
    const composite = `${listenerId}:${key}`;
    if (seenKeys.has(composite)) {
      throw new DaemonError(
        ErrorCodes.VALIDATION,
        "duplicate listener idempotency key",
        409,
      );
    }
    if (seenKeys.size >= MAX_KEYS) {
      const first = seenKeys.keys().next().value;
      if (first) seenKeys.delete(first);
    }
    seenKeys.set(composite, Date.now());
  }

  normalizeBatch(body: unknown): IngestRecord[] {
    if (Array.isArray(body)) {
      return this.webhooks.normalizePayload({ records: body });
    }
    if (typeof body === "object" && body !== null && "events" in body) {
      return this.webhooks.normalizePayload(body);
    }
    return this.webhooks.normalizePayload(body);
  }

  ingest(
    ctx: TenantContextHeaders,
    listenerId: string,
    records: IngestRecord[],
  ) {
    return this.webhooks.ingest(ctx, `listener:${listenerId}`, records);
  }
}
