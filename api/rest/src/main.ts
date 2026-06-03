import { createRestServer } from "./server.js";

/**
 * Standalone bootstrap for the REST surface. Reads `PORT` (default 8090) and
 * starts the shared read/write server. The gateway remains the primary
 * entrypoint; this app exists for deployments that want REST in isolation.
 */
const port = Number(process.env.PORT ?? 8090);
const server = createRestServer();

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[daemon] REST API listening on :${port}`);
});
