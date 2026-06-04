import type { RawRecord, SourceConnector } from "../connector.js";
import { toRawRecords } from "../connector.js";

export interface KafkaConsumerConnectorConfig {
  readonly sourceId: string;
  readonly brokers: readonly string[];
  readonly topic: string;
  readonly groupId?: string;
  readonly maxMessages?: number;
  readonly recordIdKey?: string;
}

async function loadKafkaJs(): Promise<typeof import("kafkajs")> {
  try {
    return await import("kafkajs");
  } catch {
    throw new Error(
      "kafka connector requires kafkajs (pnpm add kafkajs in collect-sensing)",
    );
  }
}

export class KafkaConsumerConnector implements SourceConnector {
  readonly kind = "event";
  readonly sourceId: string;

  constructor(private readonly config: KafkaConsumerConnectorConfig) {
    this.sourceId = config.sourceId;
  }

  async fetch(): Promise<RawRecord[]> {
    const { Kafka } = await loadKafkaJs();
    const kafka = new Kafka({
      clientId: `daemon-ingest-${this.config.sourceId}`,
      brokers: [...this.config.brokers],
    });
    const consumer = kafka.consumer({
      groupId: this.config.groupId ?? `daemon-${this.config.sourceId}`,
    });
    await consumer.connect();
    await consumer.subscribe({ topic: this.config.topic, fromBeginning: false });
    const max = this.config.maxMessages ?? 500;
    const rows: Record<string, unknown>[] = [];
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        void consumer.disconnect().finally(() => resolve());
      }, 10_000);
      consumer
        .run({
          eachMessage: async ({ message }) => {
            if (rows.length >= max) return;
            const raw = message.value?.toString("utf8");
            if (!raw) return;
            try {
              const parsed = JSON.parse(raw) as unknown;
              if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
                rows.push(parsed as Record<string, unknown>);
              } else if (Array.isArray(parsed)) {
                for (const item of parsed) {
                  if (
                    typeof item === "object" &&
                    item !== null &&
                    !Array.isArray(item)
                  ) {
                    rows.push(item as Record<string, unknown>);
                  }
                }
              }
            } catch {
              rows.push({ payload: raw });
            }
            if (rows.length >= max) {
              clearTimeout(timer);
              await consumer.disconnect();
              resolve();
            }
          },
        })
        .catch(reject);
    });
    return toRawRecords(this.sourceId, rows, this.config.recordIdKey);
  }
}
