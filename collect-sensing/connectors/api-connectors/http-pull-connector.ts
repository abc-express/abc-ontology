/** Spec: collect-sensing/connectors/api-connectors/http-pull-connector.ts */
import {
  type RawRecord,
  type SourceConnector,
  toRawRecords,
} from "../connector.js";

/** Minimal fetch surface so the connector is testable without the network. */
export type HttpFetch = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export interface HttpPullConnectorConfig {
  readonly sourceId: string;
  /** Absolute URL to pull a JSON array (or object containing one) from. */
  readonly url: string;
  /** Optional request headers (e.g. auth token from sources/ config). */
  readonly headers?: Record<string, string>;
  /** Dot-free key holding the array when the body is an envelope object. */
  readonly itemsKey?: string;
  /** Field used as the per-record id. */
  readonly recordIdKey?: string;
}

function selectRows(body: unknown, itemsKey?: string): Record<string, unknown>[] {
  const candidate =
    itemsKey && typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)[itemsKey]
      : body;
  if (!Array.isArray(candidate)) {
    throw new Error("http-pull-connector expected a JSON array of records");
  }
  return candidate.filter(
    (row): row is Record<string, unknown> =>
      typeof row === "object" && row !== null && !Array.isArray(row),
  );
}

export class HttpPullConnector implements SourceConnector {
  readonly kind = "api";
  readonly sourceId: string;

  constructor(
    private readonly httpFetch: HttpFetch,
    private readonly config: HttpPullConnectorConfig,
  ) {
    if (!config.url.trim()) {
      throw new Error("http-pull-connector requires a non-empty url");
    }
    this.sourceId = config.sourceId;
  }

  async fetch(): Promise<RawRecord[]> {
    const init = this.config.headers ? { headers: this.config.headers } : undefined;
    const res = await this.httpFetch(this.config.url, init);
    if (!res.ok) {
      throw new Error(`http-pull-connector ${this.config.url} -> ${res.status}`);
    }
    const rows = selectRows(await res.json(), this.config.itemsKey);
    return toRawRecords(this.sourceId, rows, this.config.recordIdKey ?? "id");
  }
}
