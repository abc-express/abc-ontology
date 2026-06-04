#!/usr/bin/env node
/** Waits for Postgres and Redis after `docker compose up`. */
const pgUrl = process.env.DAEMON_POSTGRES_URL ?? "postgresql://daemon:daemon@127.0.0.1:5432/daemon";
const redisUrl = process.env.DAEMON_REDIS_URL ?? "redis://127.0.0.1:6379";

async function waitPg(maxMs = 60_000) {
  const { default: pg } = await import("pg");
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const client = new pg.Client({ connectionString: pgUrl });
    try {
      await client.connect();
      await client.query("SELECT 1");
      await client.end();
      return;
    } catch {
      try {
        await client.end();
      } catch {
        /* not connected */
      }
      await new Promise((r) => setTimeout(r, 500));
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

async function waitNeo4jBolt(maxMs = 90_000) {
  const uri = process.env.DAEMON_NEO4J_URI;
  if (!uri) return;
  const { default: net } = await import("node:net");
  const parsed = new URL(uri.replace(/^bolt\+ssc?:\/\//, "bolt://"));
  const host = parsed.hostname || "127.0.0.1";
  const port = Number(parsed.port || 7687);
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const ok = await new Promise((resolve) => {
      const socket = net.connect({ host, port }, () => {
        socket.end();
        resolve(true);
      });
      socket.on("error", () => resolve(false));
      socket.setTimeout(2000, () => {
        socket.destroy();
        resolve(false);
      });
    });
    if (ok) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`neo4j bolt not ready: ${uri}`);
}

await waitPg();
await waitRedis();
await waitNeo4jBolt();
const neo4jNote = process.env.DAEMON_NEO4J_URI
  ? "neo4j bolt port open"
  : "neo4j skipped (DAEMON_NEO4J_URI unset)";
console.log(`postgres and redis are ready; ${neo4jNote}`);
