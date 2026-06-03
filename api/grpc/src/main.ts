import { createGrpcServer, ServerCredentials } from "./server.js";

/**
 * Standalone bootstrap for the gRPC surface. Reads `PORT` (default 8092) and
 * binds an insecure listener (dev only; production fronts this with TLS via
 * the gateway/mesh).
 */
const port = Number(process.env.PORT ?? 8092);
const server = createGrpcServer();

server.bindAsync(`0.0.0.0:${port}`, ServerCredentials.createInsecure(), (err, bound) => {
  if (err) {
    // eslint-disable-next-line no-console
    console.error(`[daemon] gRPC bind failed:`, err.message);
    process.exit(1);
  }
  // eslint-disable-next-line no-console
  console.log(`[daemon] gRPC API listening on :${bound}`);
});
