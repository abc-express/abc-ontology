import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthService } from "./auth.service";
import { AuthGuard } from "./auth.guard";
import { PROTECTED_KEY } from "./protected.decorator";

interface FakeRequest {
  headers: Record<string, string>;
  daemonSession?: unknown;
}

function contextFor(request: FakeRequest, protectedRoute: boolean): ExecutionContext {
  const handler = (): void => {};
  if (protectedRoute) {
    Reflect.defineMetadata(PROTECTED_KEY, true, handler);
  }
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

const GUARD_TEST_KEY = "guard-unit-test-key";
const auth = AuthService.create({
  DAEMON_AUTH_MODE: "dev",
  DAEMON_API_KEY: GUARD_TEST_KEY,
  NODE_ENV: "development",
} as NodeJS.ProcessEnv);
const guard = new AuthGuard(auth, new Reflector());

test("attaches a resolved session to the request", async () => {
  const request: FakeRequest = { headers: { "x-api-key": GUARD_TEST_KEY } };
  assert.equal(await guard.canActivate(contextFor(request, false)), true);
  assert.ok(request.daemonSession);
});

test("open route passes without a session", async () => {
  const request: FakeRequest = { headers: {} };
  assert.equal(await guard.canActivate(contextFor(request, false)), true);
  assert.equal(request.daemonSession, undefined);
});

test("protected route without a session is rejected", async () => {
  const request: FakeRequest = { headers: {} };
  await assert.rejects(
    () => guard.canActivate(contextFor(request, true)),
    UnauthorizedException,
  );
});

test("malformed credential is surfaced as unauthorized", async () => {
  const request: FakeRequest = { headers: { "x-api-key": "bogus" } };
  await assert.rejects(
    () => guard.canActivate(contextFor(request, true)),
    UnauthorizedException,
  );
});
