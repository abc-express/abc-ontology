import { createClient, type RedisClientType } from "redis";

export type RedisConfig = {
  url: string;
};

export class RedisCacheClient {
  private readonly client: RedisClientType;

  constructor(config: RedisConfig) {
    this.client = createClient({ url: config.url });
  }

  async connect(): Promise<void> {
    if (!this.client.isOpen) {
      await this.client.connect();
    }
  }

  async ping(): Promise<"PONG"> {
    await this.connect();
    const reply = await this.client.ping();
    if (reply !== "PONG") {
      throw new Error(`unexpected redis ping: ${reply}`);
    }
    return "PONG";
  }

  async close(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.quit();
    }
  }
}
