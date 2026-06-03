import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  Server,
  ServerCredentials,
  loadPackageDefinition,
  status as grpcStatus,
  type ServerUnaryCall,
  type sendUnaryData,
  type handleUnaryCall,
} from "@grpc/grpc-js";
import { loadSync } from "@grpc/proto-loader";
import { ReadRouter } from "@daemon/read-write-loops/reads/read-router.js";
import { defaultOntology } from "@daemon/ontology";
import { entityId, ontologyId } from "@daemon/platform-types";

const here = dirname(fileURLToPath(import.meta.url));
// src/server.ts and dist/server.js both live one level under the package root,
// so the proto resolves to ../proto/daemon.proto from either layout.
const protoPath = join(here, "..", "proto", "daemon.proto");

interface HealthReply {
  status: string;
}

interface ReadRequest {
  entity_id: string;
  ontology_id: string;
}

interface EntityReply {
  entity_id: string;
  ontology_id: string;
  version: number;
  updated_at: string;
  properties_json: string;
}

/**
 * Loads the proto definition and returns the gRPC service implementation. The
 * Read RPC reuses {@link ReadRouter} so the gRPC surface shares read semantics
 * with the gateway and REST app.
 */
function buildImplementation(): {
  Health: handleUnaryCall<unknown, HealthReply>;
  Read: handleUnaryCall<ReadRequest, EntityReply>;
} {
  const reads = new ReadRouter();

  return {
    Health(_call, callback: sendUnaryData<HealthReply>) {
      callback(null, { status: "ok" });
    },
    Read(
      call: ServerUnaryCall<ReadRequest, EntityReply>,
      callback: sendUnaryData<EntityReply>,
    ) {
      const req = call.request;
      const ont = ontologyId(req.ontology_id || defaultOntology());
      try {
        const record = reads.route({
          ontologyId: ont,
          entityId: entityId(req.entity_id),
        });
        callback(null, {
          entity_id: record.entityId,
          ontology_id: record.ontologyId,
          version: record.version,
          updated_at: record.updatedAt,
          properties_json: JSON.stringify(record.properties),
        });
      } catch {
        callback({
          code: grpcStatus.NOT_FOUND,
          message: `entity not found: ${ont}/${req.entity_id}`,
        });
      }
    },
  };
}

/**
 * Builds an unstarted gRPC {@link Server} with the Daemon service registered.
 * Callers bind a port with `bindAsync`; tests use `127.0.0.1:0` for an
 * ephemeral port.
 */
export function createGrpcServer(): Server {
  const packageDefinition = loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const proto = loadPackageDefinition(packageDefinition) as unknown as {
    daemon: { v1: { Daemon: { service: never } } };
  };

  const server = new Server();
  server.addService(proto.daemon.v1.Daemon.service, buildImplementation());
  return server;
}

export { ServerCredentials };
