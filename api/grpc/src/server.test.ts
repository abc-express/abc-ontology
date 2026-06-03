import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  Client,
  credentials,
  loadPackageDefinition,
  type ServiceError,
} from "@grpc/grpc-js";
import { loadSync } from "@grpc/proto-loader";
import { globalRegistry, defaultOntology } from "@daemon/ontology";
import { entityId } from "@daemon/platform-types";
import { createGrpcServer, ServerCredentials } from "./server.js";

const here = dirname(fileURLToPath(import.meta.url));
const protoPath = join(here, "..", "proto", "daemon.proto");

function loadClientCtor() {
  const def = loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const proto = loadPackageDefinition(def) as unknown as {
    daemon: { v1: { Daemon: typeof Client } };
  };
  return proto.daemon.v1.Daemon;
}

async function withClient(
  fn: (client: any) => Promise<void>,
): Promise<void> {
  const server = createGrpcServer();
  const port: number = await new Promise((resolve, reject) => {
    server.bindAsync("127.0.0.1:0", ServerCredentials.createInsecure(), (err, p) => {
      if (err) reject(err);
      else resolve(p);
    });
  });
  const Ctor = loadClientCtor();
  const client = new (Ctor as any)(`127.0.0.1:${port}`, credentials.createInsecure());
  try {
    await fn(client);
  } finally {
    client.close();
    await new Promise<void>((resolve) => server.tryShutdown(() => resolve()));
  }
}

test("Health RPC returns ok", async () => {
  await withClient(
    (client) =>
      new Promise<void>((resolve, reject) => {
        client.Health({}, (err: ServiceError | null, reply: { status: string }) => {
          if (err) return reject(err);
          assert.equal(reply.status, "ok");
          resolve();
        });
      }),
  );
});

test("Read RPC resolves a registered entity", async () => {
  globalRegistry.register(defaultOntology(), { name: "Grpc Co" }, entityId("grpc-entity-1"));
  await withClient(
    (client) =>
      new Promise<void>((resolve, reject) => {
        client.Read(
          { entity_id: "grpc-entity-1", ontology_id: "" },
          (err: ServiceError | null, reply: { entity_id: string; version: number; properties_json: string }) => {
            if (err) return reject(err);
            assert.equal(reply.entity_id, "grpc-entity-1");
            assert.equal(reply.version, 1);
            assert.equal(JSON.parse(reply.properties_json).name, "Grpc Co");
            resolve();
          },
        );
      }),
  );
});

test("Read RPC returns NOT_FOUND for unknown entity", async () => {
  await withClient(
    (client) =>
      new Promise<void>((resolve, reject) => {
        client.Read(
          { entity_id: "missing", ontology_id: "" },
          (err: ServiceError | null) => {
            if (!err) return reject(new Error("expected NOT_FOUND error"));
            assert.equal(err.code, 5); // grpc status NOT_FOUND
            resolve();
          },
        );
      }),
  );
});
