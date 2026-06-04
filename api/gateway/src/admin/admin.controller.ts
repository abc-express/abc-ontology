import { Controller, Get } from "@nestjs/common";
import { Protected } from "../auth/protected.decorator";

@Controller("v1/admin")
export class AdminController {
  @Get("status")
  @Protected()
  status() {
    return {
      gateway: "ok",
      authMode: process.env.DAEMON_AUTH_MODE ?? "dev",
      postgresConfigured: Boolean(process.env.DAEMON_POSTGRES_URL),
      ingestUrl: process.env.DAEMON_INGEST_URL ?? "http://127.0.0.1:8081",
      repoRoot: process.env.DAEMON_REPO_ROOT ?? process.cwd(),
    };
  }
}
