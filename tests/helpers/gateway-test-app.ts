import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { INestApplication } from "@nestjs/common";
import { AppModule } from "../../api/gateway/dist/app.module.js";

export type GatewayTestApp = {
  app: INestApplication;
  baseUrl: string;
  close: () => Promise<void>;
};

/** Boots the Nest gateway on a random port for HTTP integration tests. */
export async function createGatewayTestApp(
  env: NodeJS.ProcessEnv = process.env,
): Promise<GatewayTestApp> {
  const prev = { ...process.env };
  Object.assign(process.env, env);
  const app = await NestFactory.create(AppModule, { logger: false });
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
    },
  };
}

export const DEV_API_KEY = "daemon-dev-key";
