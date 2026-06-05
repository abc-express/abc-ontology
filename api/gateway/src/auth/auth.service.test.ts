import { test } from "node:test";
import assert from "node:assert/strict";
import { AuthService } from "./auth.service";

test("assertBootConfig throws in production without API keys", () => {
  assert.throws(
    () =>
      AuthService.assertBootConfig({
        NODE_ENV: "production",
        DAEMON_AUTH_MODE: "prod",
        DAEMON_API_KEYS: "",
      }),
    /DAEMON_API_KEYS must be set/,
  );
});

test("assertBootConfig allows production with explicit API keys", () => {
  assert.doesNotThrow(() =>
    AuthService.assertBootConfig({
      NODE_ENV: "production",
      DAEMON_AUTH_MODE: "prod",
      DAEMON_API_KEYS: "k1:u1:inst-alpha:admin",
    }),
  );
});

test("dev mode injects DAEMON_API_KEY when NODE_ENV is not production", async () => {
  const devKey = "test-dev-api-key";
  const svc = AuthService.create({
    NODE_ENV: "development",
    DAEMON_AUTH_MODE: "dev",
    DAEMON_API_KEY: devKey,
  });
  const session = await svc.resolveSession({ "x-api-key": devKey });
  assert.ok(session);
  assert.equal(session?.tenantId, "inst-alpha");
  assert.ok(session?.roles.includes("admin"));
});

test("rejects x-daemon-session in production", async () => {
  const svc = AuthService.create({
    NODE_ENV: "production",
    DAEMON_AUTH_MODE: "prod",
    DAEMON_API_KEYS: "k1:u1:inst-alpha:admin",
  });
  await assert.rejects(
    () =>
      svc.resolveSession({
        "x-daemon-session": JSON.stringify({
          sessionId: "s1",
          subjectId: "u1",
          tenantId: "inst-alpha",
          roles: ["admin"],
        }),
      }),
    /x-daemon-session is not accepted/,
  );
});
