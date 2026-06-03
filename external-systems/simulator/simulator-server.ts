import http from "node:http";

/** Lightweight HTTP simulator for contract tests (not domain mocks). */
export function createSimulatorServer(): http.Server {
  const records: Record<string, unknown>[] = [
    { externalId: "sim-1", properties: { name: "Simulator Entity" } },
  ];
  return http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }
    if (req.method === "GET" && req.url === "/records") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(records));
      return;
    }
    res.writeHead(404);
    res.end();
  });
}
