import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { WebSocket } from "ws";
import { createWebSocketServer, type JobStatus } from "./server.js";

/**
 * Starts the server on an ephemeral port, opens a client, runs `fn`, and tears
 * everything down. The `fetchJobStatus` provider is deterministic so no live
 * orchestrator is required.
 */
async function withClient(
  provider: (jobId: string) => Promise<JobStatus>,
  fn: (client: WebSocket) => Promise<void>,
): Promise<void> {
  const server = createWebSocketServer({ fetchJobStatus: provider, pollIntervalMs: 10 });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  const client = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise<void>((resolve, reject) => {
    client.once("open", resolve);
    client.once("error", reject);
  });
  try {
    await fn(client);
  } finally {
    client.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function nextMessage(client: WebSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    client.once("message", (raw) => resolve(JSON.parse(raw.toString())));
  });
}

test("ping yields pong", async () => {
  await withClient(
    async () => ({ id: "x", state: "running" }),
    async (client) => {
      client.send(JSON.stringify({ type: "ping" }));
      const reply = await nextMessage(client);
      assert.equal(reply.type, "pong");
    },
  );
});

test("subscribe streams status frames until terminal", async () => {
  const states = ["queued", "running", "completed"];
  let i = 0;
  await withClient(
    async (jobId) => ({ id: jobId, state: states[Math.min(i++, states.length - 1)] }),
    async (client) => {
      const received: string[] = [];
      await new Promise<void>((resolve) => {
        client.on("message", (raw) => {
          const msg = JSON.parse(raw.toString());
          if (msg.type === "status") received.push((msg.job as JobStatus).state);
          if (msg.type === "complete") resolve();
        });
        client.send(JSON.stringify({ type: "subscribe", jobId: "job-1" }));
      });
      assert.deepEqual(received, ["queued", "running", "completed"]);
    },
  );
});

test("provider failure produces a failed status then complete", async () => {
  await withClient(
    async () => {
      throw new Error("boom");
    },
    async (client) => {
      const frames: Record<string, unknown>[] = [];
      await new Promise<void>((resolve) => {
        client.on("message", (raw) => {
          const msg = JSON.parse(raw.toString());
          frames.push(msg);
          if (msg.type === "complete") resolve();
        });
        client.send(JSON.stringify({ type: "subscribe", jobId: "job-err" }));
      });
      const status = frames.find((f) => f.type === "status");
      assert.ok(status);
      assert.equal((status!.job as JobStatus).state, "failed");
    },
  );
});

test("invalid frame yields an error response", async () => {
  await withClient(
    async () => ({ id: "x", state: "running" }),
    async (client) => {
      client.send("not json");
      const reply = await nextMessage(client);
      assert.equal(reply.type, "error");
    },
  );
});
