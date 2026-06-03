import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

/** Minimal Go-ingest stand-in for gateway HTTP tests. */
export async function startMockIngestServer(): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  const server: Server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      if (req.method === "POST" && req.url === "/ingest/records") {
        const parsed = JSON.parse(raw || "{}") as { records?: unknown[] };
        const n = parsed.records?.length ?? 0;
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ jobId: "mock", status: "accepted", accepted: n }));
        return;
      }
      if (req.method === "POST" && req.url === "/v1/jobs") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ jobId: "mock-job", status: "queued", sourceId: "s1" }));
        return;
      }
      res.writeHead(404);
      res.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
