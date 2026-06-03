import { createWebSocketServer } from "./server.js";

/**
 * Standalone bootstrap for the WebSocket job-status surface. Reads `PORT`
 * (default 8093) and streams ingest job status from `DAEMON_INGEST_URL`.
 */
const port = Number(process.env.PORT ?? 8093);
const server = createWebSocketServer();

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[daemon] WebSocket API listening on :${port}`);
});
