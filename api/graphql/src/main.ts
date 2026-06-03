import { createGraphQLServer } from "./server.js";

/**
 * Standalone bootstrap for the GraphQL surface. Reads `PORT` (default 8091)
 * and starts the read-only schema server.
 */
const port = Number(process.env.PORT ?? 8091);
const server = createGraphQLServer();

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[daemon] GraphQL API listening on :${port}`);
});
