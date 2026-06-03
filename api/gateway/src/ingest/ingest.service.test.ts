import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { DaemonError, ErrorCodes, entityId, ontologyId } from "@daemon/platform-types";
import { globalRegistry } from "@daemon/ontology";
import { IngestService } from "./ingest.service";

type Handler = (method: string, url: string, body: string) => {
  status: number;
  body: unknown;
};

/** Spins up a fake orchestrator, runs `fn` against an IngestService bound to it. */
async function withOrchestrator(
  handler: Handler,
  fn: (svc: IngestService) => Promise<void>,
): Promise<void> {
  const server: Server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const { status, body } = handler(req.method ?? "GET", req.url ?? "/", raw);
      const payload = JSON.stringify(body);
      res.writeHead(status, { "content-type": "application/json" });
      res.end(payload);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  const svc = IngestService.create({
    DAEMON_INGEST_URL: `http://127.0.0.1:${port}`,
  } as NodeJS.ProcessEnv);
  try {
    await fn(svc);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test("startJob posts to /v1/jobs and returns the job", async () => {
  await withOrchestrator(
    (method, url) => {
      assert.equal(method, "POST");
      assert.equal(url, "/v1/jobs");
      return { status: 200, body: { jobId: "j1", status: "queued", sourceId: "s1" } };
    },
    async (svc) => {
      const job = await svc.startJob("s1");
      assert.equal(job.jobId, "j1");
      assert.equal(job.status, "queued");
    },
  );
});

test("getJob maps a 404 to NOT_FOUND", async () => {
  await withOrchestrator(
    () => ({ status: 404, body: { error: "missing" } }),
    async (svc) => {
      await assert.rejects(
        () => svc.getJob("nope"),
        (err: unknown) =>
          err instanceof DaemonError && err.code === ErrorCodes.NOT_FOUND,
      );
    },
  );
});

test("ingestRecords forwards the batch and returns acceptance", async () => {
  await withOrchestrator(
    (_method, url, body) => {
      assert.equal(url, "/ingest/records");
      const parsed = JSON.parse(body) as { records: unknown[] };
      assert.equal(parsed.records.length, 2);
      return { status: 200, body: { jobId: "j2", status: "accepted", accepted: 2 } };
    },
    async (svc) => {
      const result = await svc.ingestRecords("s1", [
        { ontologyId: "o", entityId: "ingest-ent-1", properties: { a: 1 } },
        { ontologyId: "o", properties: { a: 2 } },
      ]);
      assert.equal(result.accepted, 2);
      assert.ok(globalRegistry.get(ontologyId("o"), entityId("ingest-ent-1")));
    },
  );
});

test("upstream 500 surfaces as an UPSTREAM DaemonError", async () => {
  await withOrchestrator(
    () => ({ status: 500, body: { error: "boom" } }),
    async (svc) => {
      await assert.rejects(
        () => svc.startJob("s1"),
        (err: unknown) =>
          err instanceof DaemonError && err.code === ErrorCodes.UPSTREAM,
      );
    },
  );
});

test("ingestRecords with skip upstream registers locally without HTTP", async () => {
  const svc = IngestService.create({
    DAEMON_INGEST_URL: "http://127.0.0.1:1",
    DAEMON_INGEST_SKIP_UPSTREAM: "1",
  } as NodeJS.ProcessEnv);
  const result = await svc.ingestRecords("dev", [
    { ontologyId: "default", entityId: "my-entity", properties: { name: "demo" } },
  ]);
  assert.equal(result.status, "accepted");
  assert.equal(result.accepted, 1);
  assert.ok(globalRegistry.get(ontologyId("default"), entityId("my-entity")));
});

test("unreachable orchestrator surfaces as UPSTREAM", async () => {
  const svc = IngestService.create({
    DAEMON_INGEST_URL: "http://127.0.0.1:1",
  } as NodeJS.ProcessEnv);
  await assert.rejects(
    () => svc.startJob("s1"),
    (err: unknown) => err instanceof DaemonError && err.code === ErrorCodes.UPSTREAM,
  );
});
