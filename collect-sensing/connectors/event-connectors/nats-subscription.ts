import type { EventMessage, EventSubscription } from "./event-subscriber-connector.js";

export interface NatsSubscriptionOptions {
  readonly servers: string;
  readonly subject: string;
}

/**
 * NATS-backed {@link EventSubscription} for event-subscriber connectors.
 * Uses dynamic import so tests without NATS do not load the client.
 */
export async function createNatsSubscription(
  options: NatsSubscriptionOptions,
): Promise<EventSubscription> {
  const { connect, StringCodec } = await import("nats");
  const sc = StringCodec();
  const nc = await connect({ servers: options.servers });
  const sub = nc.subscribe(options.subject);
  const buffer: EventMessage[] = [];

  (async () => {
    for await (const msg of sub) {
      buffer.push({
        subject: msg.subject,
        data: sc.decode(msg.data),
      });
    }
  })().catch(() => {
    /* subscription closed */
  });

  return {
    async pull(max: number, timeoutMs: number): Promise<EventMessage[]> {
      const deadline = Date.now() + timeoutMs;
      while (buffer.length < max && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 25));
      }
      return buffer.splice(0, max);
    },
    async close(): Promise<void> {
      sub.unsubscribe();
      await nc.drain();
    },
  };
}
