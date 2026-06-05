import { Injectable } from "@nestjs/common";
import * as jose from "jose";
import {
  DaemonError,
  ErrorCodes,
  type DaemonSession,
  type SessionId,
} from "@daemon/platform-types";

export interface AuthHeaders {
  "x-api-key"?: string;
  authorization?: string;
  "x-daemon-session"?: string;
}

interface ApiKeyRecord {
  key: string;
  subjectId: string;
  tenantId: string;
  roles: string[];
}

/**
 * Resolves a {@link DaemonSession} from API key, OIDC JWT (prod), unsigned JWT (dev),
 * or internal `x-daemon-session` header.
 */
@Injectable()
export class AuthService {
  private readonly apiKeys: ReadonlyMap<string, ApiKeyRecord>;
  private readonly mode: string;
  private readonly env: NodeJS.ProcessEnv;
  private jwks?: jose.JWTVerifyGetKey;

  constructor(env: NodeJS.ProcessEnv) {
    this.env = env;
    this.mode = AuthService.resolveAuthMode(env);
    this.apiKeys = AuthService.parseApiKeys(env.DAEMON_API_KEYS, this.mode, env);
  }

  /** Nest and tests should use this; avoids DI on `process.env`. */
  static create(env: NodeJS.ProcessEnv = process.env): AuthService {
    return new AuthService(env);
  }

  static resolveAuthMode(env: NodeJS.ProcessEnv): string {
    if (env.DAEMON_AUTH_MODE) {
      return env.DAEMON_AUTH_MODE;
    }
    return env.NODE_ENV === "production" ? "prod" : "dev";
  }

  /** Refuse boot in production without explicit API keys. */
  static assertBootConfig(env: NodeJS.ProcessEnv = process.env): void {
    const mode = AuthService.resolveAuthMode(env);
    const nodeEnv = env.NODE_ENV ?? "development";
    if (mode === "prod" || nodeEnv === "production") {
      if (!env.DAEMON_API_KEYS?.trim()) {
        throw new Error("DAEMON_API_KEYS must be set in production auth mode");
      }
    }
    if (mode === "dev" && nodeEnv !== "production") {
      console.warn(
        "[daemon-auth] dev mode: unsigned JWT and default dev key may be active",
      );
    }
  }

  /** Resolves a session, or `null` when no credential is present. Throws on malformed credentials. */
  async resolveSession(headers: AuthHeaders): Promise<DaemonSession | null> {
    const raw = headers["x-daemon-session"];
    if (raw) {
      if (this.mode === "prod" || this.env.NODE_ENV === "production") {
        throw new DaemonError(
          ErrorCodes.UNAUTHORIZED,
          "x-daemon-session is not accepted in production",
          401,
        );
      }
      return this.fromSessionHeader(raw);
    }

    const apiKey = headers["x-api-key"];
    if (apiKey) {
      return this.fromApiKey(apiKey);
    }

    const authorization = headers.authorization;
    if (authorization) {
      return this.fromBearer(authorization);
    }

    return null;
  }

  private fromSessionHeader(raw: string): DaemonSession {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new DaemonError(ErrorCodes.UNAUTHORIZED, "malformed x-daemon-session header", 401);
    }
    return AuthService.coerceSession(parsed);
  }

  private fromApiKey(apiKey: string): DaemonSession {
    const record = this.apiKeys.get(apiKey);
    if (!record) {
      throw new DaemonError(ErrorCodes.UNAUTHORIZED, "unknown api key", 401);
    }
    return {
      sessionId: `apikey:${record.key}` as SessionId,
      subjectId: record.subjectId,
      tenantId: record.tenantId,
      roles: [...record.roles],
      issuedAt: new Date().toISOString(),
    };
  }

  private async fromBearer(authorization: string): Promise<DaemonSession> {
    const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
    if (!match) {
      throw new DaemonError(ErrorCodes.UNAUTHORIZED, "invalid authorization scheme", 401);
    }
    const token = match[1];
    if (this.mode === "dev" && !this.env.DAEMON_OIDC_JWKS_URL) {
      return this.fromUnsignedJwtDev(token);
    }
    return this.fromVerifiedJwt(token);
  }

  private fromUnsignedJwtDev(token: string): DaemonSession {
    const claims = AuthService.decodeJwtClaims(token);
    return {
      sessionId: `jwt:${String(claims.sub ?? "anonymous")}` as SessionId,
      subjectId: String(claims.sub ?? "anonymous"),
      tenantId: String(claims.tenant ?? claims.tid ?? "inst-alpha"),
      roles: AuthService.coerceRoles(claims.roles),
      issuedAt: new Date().toISOString(),
    };
  }

  private getJwks(): jose.JWTVerifyGetKey {
    const url = this.env.DAEMON_OIDC_JWKS_URL;
    if (!url) {
      throw new DaemonError(
        ErrorCodes.UNAUTHORIZED,
        "OIDC JWKS URL not configured",
        401,
      );
    }
    if (!this.jwks) {
      this.jwks = jose.createRemoteJWKSet(new URL(url));
    }
    return this.jwks;
  }

  private async fromVerifiedJwt(token: string): Promise<DaemonSession> {
    const issuer = this.env.DAEMON_OIDC_ISSUER;
    const audience = this.env.DAEMON_OIDC_AUDIENCE;
    try {
      const { payload } = await jose.jwtVerify(token, this.getJwks(), {
        issuer: issuer || undefined,
        audience: audience || undefined,
      });
      return {
        sessionId: `jwt:${String(payload.sub ?? "anonymous")}` as SessionId,
        subjectId: String(payload.sub ?? "anonymous"),
        tenantId: String(
          payload.tenant ?? payload.tid ?? payload["https://daemon/tenant"] ?? "default",
        ),
        roles: AuthService.coerceRoles(payload.roles ?? payload["https://daemon/roles"]),
        issuedAt: new Date().toISOString(),
      };
    } catch {
      throw new DaemonError(ErrorCodes.UNAUTHORIZED, "invalid or expired jwt", 401);
    }
  }

  private static decodeJwtClaims(token: string): Record<string, unknown> {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new DaemonError(ErrorCodes.UNAUTHORIZED, "malformed jwt", 401);
    }
    try {
      const payload = Buffer.from(parts[1], "base64url").toString("utf8");
      const claims = JSON.parse(payload) as unknown;
      if (typeof claims !== "object" || claims === null) {
        throw new Error("non-object claims");
      }
      return claims as Record<string, unknown>;
    } catch {
      throw new DaemonError(ErrorCodes.UNAUTHORIZED, "undecodable jwt payload", 401);
    }
  }

  private static coerceSession(value: unknown): DaemonSession {
    if (typeof value !== "object" || value === null) {
      throw new DaemonError(ErrorCodes.UNAUTHORIZED, "session must be an object", 401);
    }
    const candidate = value as Record<string, unknown>;
    const subjectId = candidate.subjectId;
    const tenantId = candidate.tenantId;
    if (typeof subjectId !== "string" || typeof tenantId !== "string") {
      throw new DaemonError(
        ErrorCodes.UNAUTHORIZED,
        "session requires subjectId and tenantId",
        401,
      );
    }
    return {
      sessionId: (typeof candidate.sessionId === "string"
        ? candidate.sessionId
        : `session:${subjectId}`) as SessionId,
      subjectId,
      tenantId,
      roles: AuthService.coerceRoles(candidate.roles),
      issuedAt:
        typeof candidate.issuedAt === "string"
          ? candidate.issuedAt
          : new Date().toISOString(),
    };
  }

  private static coerceRoles(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.filter((entry): entry is string => typeof entry === "string");
    }
    return [];
  }

  private static parseApiKeys(
    raw: string | undefined,
    mode: string,
    env: NodeJS.ProcessEnv,
  ): Map<string, ApiKeyRecord> {
    const keys = new Map<string, ApiKeyRecord>();
    if (raw) {
      for (const entry of raw.split(",").map((part) => part.trim()).filter(Boolean)) {
        const [key, subjectId = "service", tenantId = "default", roleList = ""] =
          entry.split(":");
        if (!key) {
          continue;
        }
        keys.set(key, {
          key,
          subjectId,
          tenantId,
          roles: roleList.split("|").map((role) => role.trim()).filter(Boolean),
        });
      }
    }
    const nodeEnv = env.NODE_ENV ?? "development";
    const devKey = env.DAEMON_API_KEY?.trim();
    if (keys.size === 0 && mode === "dev" && nodeEnv !== "production" && devKey) {
      keys.set(devKey, {
        key: devKey,
        subjectId: "dev",
        tenantId: "inst-alpha",
        roles: ["admin"],
      });
    }
    return keys;
  }
}
