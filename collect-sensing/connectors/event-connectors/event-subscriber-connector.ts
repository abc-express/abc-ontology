/** Spec: collect-sensing/connectors/event-connectors/event-subscriber-connector.ts */
import {
  type RawRecord,
  type SourceConnector,
  toRawRecords,
} from "../connector.js";

/** A single message delivered by an event transport (e.g. NATS subject). */
export interface EventMessage {
  readonly subject: string;
  /** Raw payload bytes as a UTF-8 string (JSON expected). */
  readonly data: string;
}

/**
 * Minimal subscription surface a transport must satisfy. A NATS client adapter
 * implements this by wrapping `connection.subscribe(subject)`; tests provide a
 * fake that yields a fixed set of messages.
 */
export interface EventSubscription {
  /** Pull up to `max` buffered messages, waiting up to `timeoutMs`. */
  pull(max: number, timeoutMs: number): Promise<EventMessage[]>;
  close(): Promise<void>;
}

export interface EventSubscriberConnectorConfig {
  readonly sourceId: string;
  readonly subject: string;
  /** Max messages to drain per fetch. Defaults to 100. */
  readonly batchSize?: number;
  /** Field used as the per-record id when present in the JSON body. */
  readonly recordIdKey?: string;
  /** Wait budget per fetch in milliseconds. Defaults to 250. */
  readonly pullTimeoutMs?: number;
}

function decodeMessage(message: EventMessage): Record<string, unknown> {
  const parsed = JSON.parse(message.data) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`event payload on ${message.subject} is not an object`);
  }
  return parsed as Record<string, unknown>;
}

/**
 * Drains messages from an {@link EventSubscription} and converts them into
 * {@link RawRecord}s. The transport is injected, so this connector works the
 * same against NATS in production and a fake subscription in tests.
 */
export class EventSubscriberConnector implements SourceConnector {
  readonly kind = "event";
  readonly sourceId: string;

  constructor(
    private readonly subscription: EventSubscription,
    private readonly config: EventSubscriberConnectorConfig,
  ) {
    this.sourceId = config.sourceId;
  }

  async fetch(): Promise<RawRecord[]> {
    const messages = await this.subscription.pull(
      this.config.batchSize ?? 100,
      this.config.pullTimeoutMs ?? 250,
    );
    const rows = messages.map(decodeMessage);
    return toRawRecords(this.sourceId, rows, this.config.recordIdKey ?? "id");
  }

  async close(): Promise<void> {
    await this.subscription.close();
  }
}
