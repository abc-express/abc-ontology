#!/usr/bin/env node
/** Waits for Postgres and Redis after `docker compose up`. */
const pgUrl = process.env.DAEMON_POSTGRES_URL ?? "postgresql://daemon:daemon@127.0.0.1:5432/daemon";
const redisUrl = process.env.DAEMON_REDIS_URL ?? "redis://127.0.0.1:6379";

async function waitPg(maxMs = 60_000) {
  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: pgUrl });
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      await client.connect();
      await client.query("SELECT 1");
      await client.end();
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error(`postgres not ready: ${pgUrl}`);
}

async function waitRedis(maxMs = 60_000) {
  const { createClient } = await import("redis");
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const client = createClient({ url: redisUrl });
    try {
      await client.connect();
      const pong = await client.ping();
      await client.quit();
      if (pong === "PONG") return;
    } catch {
      /* retry */
    }
  }
  throw new Error(`redis not ready: ${redisUrl}`);
}

await waitPg();
await waitRedis();
console.log("postgres and redis are ready");
