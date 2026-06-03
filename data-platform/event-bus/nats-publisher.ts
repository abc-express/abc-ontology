/** Optional NATS publisher; no-ops when DAEMON_NATS_URL is unset. */
export type EventEnvelope = {
  topic: string;
  payload: Record<string, unknown>;
  at: string;
};

export class NatsEventPublisher {
  private readonly url: string | undefined;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.url = env.DAEMON_NATS_URL;
  }

  enabled(): boolean {
    return Boolean(this.url);
  }

  /** Publishes when NATS is configured; otherwise records locally for tests. */
  async publish(topic: string, payload: Record<string, unknown>): Promise<EventEnvelope> {
    const envelope: EventEnvelope = {
      topic,
      payload,
      at: new Date().toISOString(),
    };
    if (!this.url) return envelope;
    const subject = topic.replace(/\./g, "_");
    const res = await fetch(`${this.url.replace(/\/+$/, "")}/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subject, data: envelope }),
    }).catch(() => null);
    if (res && !res.ok) {
      throw new Error(`nats publish failed: ${res.status}`);
    }
    return envelope;
  }
}
