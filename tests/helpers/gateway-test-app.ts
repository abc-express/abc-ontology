import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { INestApplication } from "@nestjs/common";
import { AppModule } from "../../api/gateway/dist/app.module.js";
import { DaemonExceptionFilter } from "../../api/gateway/dist/daemon-exception.filter.js";
import { resetDaemonRuntimeForTests } from "../../api/gateway/src/platform/daemon-runtime.js";
import { resolvePostgresUrlForTests } from "./postgres-integration.js";
import { primaryTestApiKey } from "./test-api-keys.js";

export type GatewayTestApp = {
  app: INestApplication;
  baseUrl: string;
  close: () => Promise<void>;
};

let gatewayTestEnvLock: Promise<void> = Promise.resolve();

/** Boots the Nest gateway on a random port for HTTP integration tests. */
export async function createGatewayTestApp(
  env: NodeJS.ProcessEnv = process.env,
): Promise<GatewayTestApp> {
  let releaseLock!: () => void;
  const prevLock = gatewayTestEnvLock;
  gatewayTestEnvLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  await prevLock;

  const prev = { ...process.env };
  const testEnv = { ...process.env, ...env };
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete testEnv[key];
    }
  }
  // Use durable Postgres only when the URL is configured and accepting connections.
  const requested = testEnv.DAEMON_POSTGRES_URL;
  if (requested) {
    const ready = await resolvePostgresUrlForTests(String(requested));
    if (ready) {
      testEnv.DAEMON_POSTGRES_URL = ready;
    } else {
      delete testEnv.DAEMON_POSTGRES_URL;
    }
  }
  resetDaemonRuntimeForTests();
  if (!testEnv.DAEMON_API_KEY?.trim()) {
    testEnv.DAEMON_API_KEY = primaryTestApiKey(testEnv);
  }
  Object.assign(process.env, testEnv);
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete process.env[key];
    }
  }
  if (!testEnv.DAEMON_POSTGRES_URL) {
    delete process.env.DAEMON_POSTGRES_URL;
  }
  const app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalFilters(new DaemonExceptionFilter());
  await app.listen(0);
  const server = app.getHttpServer();
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 3000;
  const baseUrl = `http://127.0.0.1:${port}`;
  return {
    app,
    baseUrl,
    async close() {
      await app.close();
      Object.assign(process.env, prev);
      for (const key of Object.keys(process.env)) {
        if (!(key in prev)) {
          delete process.env[key];
        }
      }
      releaseLock();
    },
  };
}

export function devApiKey(env: NodeJS.ProcessEnv = process.env): string {
  return primaryTestApiKey(env);
}

/** Tenant/domain headers expected by {@link TenantContextService}. */
export function daemonTenantHeaders(
  tenantId = "inst-alpha",
  domainId = "foundation",
  extra: Record<string, string> = {},
): Record<string, string> {
  return {
    "x-daemon-tenant": tenantId,
    "x-daemon-domain": domainId,
    ...extra,
  };
}
