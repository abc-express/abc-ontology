import type { DaemonSession } from "@daemon/platform-types";
import { DaemonError, ErrorCodes } from "@daemon/platform-types";
import type {
  AutomationsApproveRequest,
  AutomationsEvaluateRequest,
  AutomationsRunRequest,
  CustomerGptChatRequest,
  CustomerGptChatResponse,
  EntityListPage,
  EntityRecord,
  IngestRecordsRequest,
  IngestScheduleInput,
  IngestScheduleRecord,
  LakehouseExportRequest,
  DataHealthSummary,
  MediaObjectInput,
  PackResolution,
  PipelineRunRequest,
  EvalSuiteInput,
  LakehouseAnalyticsReport,
  LakehouseEventsParams,
  LakehouseSummary,
  PolicyDecision,
  QueryAskRequest,
  SearchResponse,
  WriteReceipt,
} from "./types.js";

export interface DaemonClientConfig {
  baseUrl: string;
  fetch?: typeof fetch;
  getSession?: () => Promise<DaemonSession | null>;
  /** Gateway API key; sent as `X-Api-Key` when set. */
  apiKey?: string;
  /** Multi-tenant scope; sent as `X-Daemon-Tenant` (default: gateway uses `default`). */
  tenantId?: string;
  /** Domain scope; sent as `X-Daemon-Domain` (default: gateway uses `foundation`). */
  domainId?: string;
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

  async readEntity(entityId: string, ontologyId: string): Promise<EntityRecord> {
    return this.request(
      "GET",
      `/v1/read/entities/${encodeURIComponent(entityId)}?ontologyId=${encodeURIComponent(ontologyId)}`,
    );
  }

  async listEntities(params: {
    ontologyId: string;
    entityType?: string;
    limit?: number;
    cursor?: string;
    updatedAfter?: string;
  }): Promise<EntityListPage> {
    const q = new URLSearchParams({ ontologyId: params.ontologyId });
    if (params.entityType) q.set("entityType", params.entityType);
    if (params.limit != null) q.set("limit", String(params.limit));
    if (params.cursor) q.set("cursor", params.cursor);
    if (params.updatedAfter) q.set("updatedAfter", params.updatedAfter);
    return this.request("GET", `/v1/read/entities?${q.toString()}`);
  }

  async search(params: {
    q: string;
    ontologyId?: string;
    limit?: number;
    mode?: "keyword" | "hybrid";
  }): Promise<SearchResponse> {
    const q = new URLSearchParams({ q: params.q });
    if (params.ontologyId) q.set("ontologyId", params.ontologyId);
    if (params.limit != null) q.set("limit", String(params.limit));
    if (params.mode) q.set("mode", params.mode);
    return this.request("GET", `/v1/search?${q.toString()}`);
  }

  async lakehouseSummary(options?: {
    since?: string;
  }): Promise<LakehouseSummary> {
    const q = new URLSearchParams();
    if (options?.since) q.set("since", options.since);
    const suffix = q.size ? `?${q.toString()}` : "";
    return this.request("GET", `/v1/lakehouse/summary${suffix}`);
  }

  async lakehouseEvents(
    params?: LakehouseEventsParams,
  ): Promise<Record<string, unknown>[]> {
    const q = new URLSearchParams();
    if (params?.since) q.set("since", params.since);
    if (params?.limit != null) q.set("limit", String(params.limit));
    if (params?.entityType) q.set("entityType", params.entityType);
    if (params?.ontologyId) q.set("ontologyId", params.ontologyId);
    if (params?.changeType) q.set("changeType", params.changeType);
    const suffix = q.size ? `?${q.toString()}` : "";
    return this.request("GET", `/v1/lakehouse/events${suffix}`);
  }

  async analyticsLakehouseSummary(options?: {
    since?: string;
    reportTitle?: string;
  }): Promise<LakehouseAnalyticsReport> {
    const q = new URLSearchParams();
    if (options?.since) q.set("since", options.since);
    if (options?.reportTitle) q.set("reportTitle", options.reportTitle);
    const suffix = q.size ? `?${q.toString()}` : "";
    return this.request("GET", `/v1/analytics/lakehouse-summary${suffix}`);
  }

  async ingestStartJob(sourceId: string): Promise<Record<string, unknown>> {
    return this.request("POST", "/v1/ingest/jobs", {
      body: JSON.stringify({ sourceId }),
    });
  }

  async ingestListJobs(): Promise<Record<string, unknown>> {
    return this.request("GET", "/v1/ingest/jobs");
  }

  async ingestGetJob(id: string): Promise<Record<string, unknown>> {
    return this.request("GET", `/v1/ingest/jobs/${encodeURIComponent(id)}`);
  }

  async ingestRunSource(sourceId: string): Promise<Record<string, unknown>> {
    return this.request(
      "POST",
      `/v1/ingest/sources/${encodeURIComponent(sourceId)}/run`,
      { body: JSON.stringify({}) },
    );
  }

  async ingestRecords(body: IngestRecordsRequest): Promise<Record<string, unknown>> {
    return this.request("POST", "/v1/ingest/records", {
      body: JSON.stringify(body),
    });
  }

  async queryAsk(body: QueryAskRequest): Promise<Record<string, unknown>> {
    return this.request("POST", "/v1/query/ask", {
      body: JSON.stringify(body),
    });
  }

  async customerGptChat(
    body: CustomerGptChatRequest,
    sessionId?: string,
  ): Promise<CustomerGptChatResponse> {
    const headers: Record<string, string> = {};
    if (sessionId) headers["x-session-id"] = sessionId;
    return this.request("POST", "/v1/products/customer-gpt/chat", {
      body: JSON.stringify(body),
      headers,
    });
  }

  async automationsRun(body: AutomationsRunRequest): Promise<Record<string, unknown>> {
    return this.request("POST", "/v1/automations/run", {
      body: JSON.stringify(body),
    });
  }

  async automationsEvaluate(
    body: AutomationsEvaluateRequest,
  ): Promise<Record<string, unknown>> {
    return this.request("POST", "/v1/automations/evaluate", {
      body: JSON.stringify(body),
    });
  }

  async automationsApprove(
    body: AutomationsApproveRequest,
  ): Promise<WriteReceipt> {
    return this.request("POST", "/v1/automations/approve", {
      body: JSON.stringify(body),
    });
  }

  async submitWrite(body: {
    entityId: string;
    ontologyId: string;
    patch: Record<string, unknown>;
    idempotencyKey?: string;
  }): Promise<WriteReceipt> {
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

  async listIngestSchedules(): Promise<IngestScheduleRecord[]> {
    return this.request("GET", "/v1/ingest/schedules");
  }

  async createIngestSchedule(
    body: IngestScheduleInput,
  ): Promise<IngestScheduleRecord> {
    return this.request("POST", "/v1/ingest/schedules", {
      body: JSON.stringify(body),
    });
  }

  async patchIngestSchedule(
    id: string,
    body: Partial<IngestScheduleInput>,
  ): Promise<IngestScheduleRecord> {
    return this.request("PATCH", `/v1/ingest/schedules/${encodeURIComponent(id)}`, {
      body: JSON.stringify(body),
    });
  }

  async ingestListenerEvents(
    listenerId: string,
    payload: unknown,
    options?: { idempotencyKey?: string },
  ): Promise<Record<string, unknown>> {
    const headers: Record<string, string> = {};
    if (options?.idempotencyKey) {
      headers["x-idempotency-key"] = options.idempotencyKey;
    }
    return this.request(
      "POST",
      `/v1/ingest/listeners/${encodeURIComponent(listenerId)}/events`,
      { body: JSON.stringify(payload), headers },
    );
  }

  async createAgentSession(body?: {
    tools?: string[];
    metadata?: Record<string, unknown>;
  }): Promise<Record<string, unknown>> {
    return this.request("POST", "/v1/agents/sessions", {
      body: JSON.stringify(body ?? {}),
    });
  }

  async invokeFunction(
    functionId: string,
    input?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.request(
      "POST",
      `/v1/functions/${encodeURIComponent(functionId)}/invoke`,
      { body: JSON.stringify({ input: input ?? {} }) },
    );
  }

  async opsHealth(): Promise<Record<string, unknown>> {
    return this.request("GET", "/v1/ops/health");
  }

  async promotePack(body: {
    packId: string;
    fromEnv?: string;
    toEnv: string;
    version?: string;
  }): Promise<Record<string, unknown>> {
    return this.request("POST", "/v1/governance/pack/promote", {
      body: JSON.stringify(body),
    });
  }

  async ingestWebhook(
    sourceId: string,
    payload: unknown,
    options?: { signature?: string },
  ): Promise<Record<string, unknown>> {
    const headers: Record<string, string> = {};
    if (options?.signature) {
      headers["x-daemon-signature"] = options.signature;
    }
    return this.request(
      "POST",
      `/v1/ingest/webhooks/${encodeURIComponent(sourceId)}`,
      { body: JSON.stringify(payload), headers },
    );
  }

  async dataHealthSummary(): Promise<DataHealthSummary> {
    return this.request("GET", "/v1/data-health/summary");
  }

  async startLakehouseExport(
    body?: LakehouseExportRequest,
  ): Promise<Record<string, unknown>> {
    return this.request("POST", "/v1/lakehouse/export", {
      body: JSON.stringify(body ?? {}),
    });
  }

  async getLakehouseExport(exportId: string): Promise<Record<string, unknown>> {
    return this.request(
      "GET",
      `/v1/lakehouse/exports/${encodeURIComponent(exportId)}`,
    );
  }

  async listMediaObjects(limit?: number): Promise<Record<string, unknown>[]> {
    const q = limit != null ? `?limit=${limit}` : "";
    return this.request("GET", `/v1/media/objects${q}`);
  }

  async registerMediaObject(
    body: MediaObjectInput,
  ): Promise<Record<string, unknown>> {
    return this.request("POST", "/v1/media/objects", {
      body: JSON.stringify(body),
    });
  }

  async ontologyPackResolution(params?: {
    environment?: string;
    packBranch?: string;
  }): Promise<PackResolution> {
    const q = new URLSearchParams();
    if (params?.environment) q.set("environment", params.environment);
    if (params?.packBranch) q.set("packBranch", params.packBranch);
    const suffix = q.size ? `?${q}` : "";
    return this.request("GET", `/v1/ontology/pack-resolution${suffix}`);
  }

  async runPipeline(
    pipelineId: string,
    body: PipelineRunRequest,
  ): Promise<Record<string, unknown>> {
    return this.request(
      "POST",
      `/v1/pipelines/${encodeURIComponent(pipelineId)}/run`,
      { body: JSON.stringify(body) },
    );
  }

  async runEvals(suite: EvalSuiteInput): Promise<Record<string, unknown>> {
    return this.request("POST", "/v1/evals/run", {
      body: JSON.stringify({ suite }),
    });
  }

  async listEvalRuns(limit?: number): Promise<Record<string, unknown>[]> {
    const q = limit != null ? `?limit=${limit}` : "";
    return this.request("GET", `/v1/evals/runs${q}`);
  }

  async recordEval(body: {
    suiteId: string;
    name: string;
    score: number;
    threshold?: number;
    metadata?: Record<string, unknown>;
  }): Promise<Record<string, unknown>> {
    return this.request("POST", "/v1/evals/record", {
      body: JSON.stringify(body),
    });
  }

  async invokeAgentTool(
    sessionId: string,
    body: { tool: string; input: Record<string, unknown> },
  ): Promise<Record<string, unknown>> {
    return this.request(
      "POST",
      `/v1/agents/sessions/${encodeURIComponent(sessionId)}/tools`,
      { body: JSON.stringify(body) },
    );
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
    if (this.config.tenantId) {
      headers["x-daemon-tenant"] = this.config.tenantId;
    }
    if (this.config.domainId) {
      headers["x-daemon-domain"] = this.config.domainId;
    }
    if (this.config.apiKey) {
      headers["x-api-key"] = this.config.apiKey;
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
