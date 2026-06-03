import type { DaemonSession, PolicyDecision } from "@daemon/platform-types";
import { DaemonError, ErrorCodes } from "@daemon/platform-types";

export interface DaemonClientConfig {
  baseUrl: string;
  fetch?: typeof fetch;
  getSession?: () => Promise<DaemonSession | null>;
}

export class DaemonClient {
  private readonly fetchFn: typeof fetch;
  private readonly getSession?: () => Promise<DaemonSession | null>;

  constructor(private readonly config: DaemonClientConfig) {
    this.fetchFn = config.fetch ?? globalThis.fetch;
    this.getSession = config.getSession;
  }

  async health(): Promise<{ status: string }> {
    return this.request("GET", "/health");
  }

  async readEntity(entityId: string, ontologyId: string): Promise<unknown> {
    return this.request(
      "GET",
      `/v1/read/entities/${encodeURIComponent(entityId)}?ontologyId=${encodeURIComponent(ontologyId)}`,
    );
  }

  async submitWrite(body: {
    entityId: string;
    ontologyId: string;
    patch: Record<string, unknown>;
    idempotencyKey?: string;
  }): Promise<{ writeId: string; status: string }> {
    return this.request("POST", "/v1/write", { body: JSON.stringify(body) });
  }

  async checkPolicy(input: {
    action: string;
    resource: string;
  }): Promise<PolicyDecision> {
    return this.request("POST", "/v1/policy/check", {
      body: JSON.stringify(input),
    });
  }

  private async request<T>(
    method: string,
    path: string,
    init?: RequestInit,
  ): Promise<T> {
    const session = this.getSession ? await this.getSession() : null;
    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...(init?.headers as Record<string, string>),
    };
    if (session) {
      headers["x-daemon-session"] = JSON.stringify(session);
    }
    const res = await this.fetchFn(`${this.config.baseUrl}${path}`, {
      ...init,
      method,
      headers,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new DaemonError(
        res.status === 403 ? ErrorCodes.POLICY_DENIED : ErrorCodes.INTERNAL,
        text || res.statusText,
        res.status,
      );
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }
}
