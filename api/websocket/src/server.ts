import { createServer, type Server as HttpServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";

/**
 * A single ingest job snapshot. Shape mirrors the Go orchestrator's
 * `GET /v1/jobs/{id}` response; only the fields the stream needs are typed.
 */
export interface JobStatus {
  id: string;
  state: string;
  [key: string]: unknown;
}

/** Resolves the current status of an ingest job. */
export type JobStatusProvider = (jobId: string) => Promise<JobStatus>;

export interface WebSocketServerOptions {
  /**
   * How to fetch job status. Defaults to polling `DAEMON_INGEST_URL`. Tests
   * inject a deterministic provider to avoid a live Go orchestrator.
   */
  fetchJobStatus?: JobStatusProvider;
  /** Poll cadence in ms (default 250). */
  pollIntervalMs?: number;
}

const TERMINAL_STATES = new Set(["completed", "failed", "cancelled"]);

/**
 * Default provider: polls the Go ingest orchestrator. Network/HTTP failures
 * surface as a `failed` status frame rather than tearing down the socket.
 */
function defaultProvider(): JobStatusProvider {
  const base = process.env.DAEMON_INGEST_URL ?? "http://127.0.0.1:8081";
  return async (jobId: string): Promise<JobStatus> => {
    const res = await fetch(`${base}/v1/jobs/${encodeURIComponent(jobId)}`);
    if (!res.ok) {
      return { id: jobId, state: "failed", error: `upstream ${res.status}` };
    }
    return (await res.json()) as JobStatus;
  };
}

/**
 * Builds the WebSocket job-status server on top of a bare HTTP server.
 *
 * Protocol (JSON text frames):
 * - `{ "type": "subscribe", "jobId": "..." }` → repeated `{ "type": "status", job }`
 *   frames until a terminal state, then `{ "type": "complete", jobId }`.
 * - `{ "type": "ping" }` → `{ "type": "pong" }`.
 *
 * The returned HTTP server is unstarted; callers invoke `.listen()`.
 */
export function createWebSocketServer(options: WebSocketServerOptions = {}): HttpServer {
  const fetchJobStatus = options.fetchJobStatus ?? defaultProvider();
  const pollIntervalMs = options.pollIntervalMs ?? 250;

  const http = createServer((req, res) => {
    if (req.method === "GET" && (req.url ?? "/").split("?")[0] === "/health") {
      const payload = JSON.stringify({ status: "ok" });
      res.writeHead(200, {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(payload),
      });
      res.end(payload);
      return;
    }
    res.writeHead(426, { "content-type": "text/plain" });
    res.end("Upgrade Required");
  });

  const wss = new WebSocketServer({ server: http });

  wss.on("connection", (socket: WebSocket) => {
    const timers = new Set<NodeJS.Timeout>();

    socket.on("message", (raw) => {
      let msg: { type?: string; jobId?: string };
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        send(socket, { type: "error", message: "invalid JSON frame" });
        return;
      }

      if (msg.type === "ping") {
        send(socket, { type: "pong" });
        return;
      }

      if (msg.type === "subscribe" && typeof msg.jobId === "string") {
        streamJob(socket, msg.jobId, fetchJobStatus, pollIntervalMs, timers);
        return;
      }

      send(socket, { type: "error", message: "unsupported frame" });
    });

    socket.on("close", () => {
      for (const t of timers) clearTimeout(t);
      timers.clear();
    });
  });

  return http;
}

function streamJob(
  socket: WebSocket,
  jobId: string,
  fetchJobStatus: JobStatusProvider,
  pollIntervalMs: number,
  timers: Set<NodeJS.Timeout>,
): void {
  const tick = async (): Promise<void> => {
    if (socket.readyState !== socket.OPEN) return;
    let job: JobStatus;
    try {
      job = await fetchJobStatus(jobId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      send(socket, { type: "status", job: { id: jobId, state: "failed", error: message } });
      send(socket, { type: "complete", jobId });
      return;
    }

    send(socket, { type: "status", job });

    if (TERMINAL_STATES.has(job.state)) {
      send(socket, { type: "complete", jobId });
      return;
    }

    const timer = setTimeout(() => {
      timers.delete(timer);
      void tick();
    }, pollIntervalMs);
    timers.add(timer);
  };

  void tick();
}

function send(socket: WebSocket, payload: unknown): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}
