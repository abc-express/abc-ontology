/**
 * OpenAPI 3.1 description of the REST surface. This mirrors the gateway's
 * read/write contract so the same handlers can be validated against a single
 * schema in {@link file://../../../tests/contract/api-contract.test.ts}.
 */

/** Scoped v1 operations accept optional tenant/domain headers (full enforcement on Nest gateway). */
const TENANCY_HEADER_PARAMS = [
  { $ref: "#/components/parameters/DaemonTenantHeader" },
  { $ref: "#/components/parameters/DaemonDomainHeader" },
] as const;

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Daemon REST API",
    version: "0.1.0",
    description:
      "Read/write access to the Daemon ontology registry over HTTP. " +
      "Optional headers X-Daemon-Tenant and X-Daemon-Domain scope requests; the NestJS gateway enforces tenant registry and enabled domains. " +
      "REST may read X-Daemon-Tenant for session defaults but does not fully mirror gateway domain validation.",
  },
  paths: {
    "/health": {
      get: {
        operationId: "health",
        summary: "Liveness probe",
        responses: {
          "200": {
            description: "Service is up",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Health" },
              },
            },
          },
        },
      },
    },
    "/v1/entities/{id}": {
      get: {
        operationId: "readEntityLegacy",
        summary: "Resolve an entity by id (legacy REST path)",
        parameters: [
          ...TENANCY_HEADER_PARAMS,
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "ontologyId",
            in: "query",
            required: false,
            schema: { type: "string", default: "foundation" },
          },
        ],
        responses: {
          "200": {
            description: "Entity record",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/EntityRecord" },
              },
            },
          },
          "404": {
            description: "Entity not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/v1/read/entities": {
      get: {
        operationId: "listEntities",
        summary: "Page entities in an ontology scope",
        parameters: [
          ...TENANCY_HEADER_PARAMS,
          {
            name: "ontologyId",
            in: "query",
            required: true,
            schema: { type: "string", default: "foundation" },
          },
          { name: "entityType", in: "query", schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
          { name: "cursor", in: "query", schema: { type: "string" } },
          {
            name: "updatedAfter",
            in: "query",
            schema: { type: "string", format: "date-time" },
          },
        ],
        responses: {
          "200": {
            description: "Entity page",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/EntityListPage" },
              },
            },
          },
        },
      },
    },
    "/v1/read/entities/{entityId}": {
      get: {
        operationId: "readEntity",
        summary: "Resolve an entity by id (gateway path)",
        parameters: [
          ...TENANCY_HEADER_PARAMS,
          {
            name: "entityId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "ontologyId",
            in: "query",
            required: true,
            schema: { type: "string", default: "foundation" },
          },
        ],
        responses: {
          "200": {
            description: "Entity record",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/EntityRecord" },
              },
            },
          },
          "404": {
            description: "Entity not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/v1/search": {
      get: {
        operationId: "ontologySearch",
        summary: "Hybrid or keyword ontology search",
        parameters: [
          ...TENANCY_HEADER_PARAMS,
          { name: "q", in: "query", required: true, schema: { type: "string" } },
          { name: "ontologyId", in: "query", schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer" } },
          {
            name: "mode",
            in: "query",
            schema: { type: "string", enum: ["keyword", "hybrid"] },
          },
        ],
        responses: {
          "200": {
            description: "Search hits",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SearchResponse" },
              },
            },
          },
        },
      },
    },
    "/v1/lakehouse/events": {
      get: {
        operationId: "lakehouseEvents",
        summary: "List lakehouse bronze events",
        parameters: [
          ...TENANCY_HEADER_PARAMS,
          { name: "since", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "limit", in: "query", schema: { type: "integer" } },
          { name: "entityType", in: "query", schema: { type: "string" } },
          { name: "ontologyId", in: "query", schema: { type: "string" } },
          {
            name: "changeType",
            in: "query",
            schema: { type: "string", enum: ["register", "patch"] },
          },
        ],
        responses: {
          "200": {
            description: "Event list",
            content: {
              "application/json": {
                schema: { type: "array", items: { type: "object", additionalProperties: true } },
              },
            },
          },
        },
      },
    },
    "/v1/lakehouse/summary": {
      get: {
        operationId: "lakehouseSummary",
        summary: "Bronze lakehouse summary (entity type counts and change volume)",
        parameters: [
          ...TENANCY_HEADER_PARAMS,
          { name: "since", in: "query", schema: { type: "string", format: "date-time" } },
        ],
        responses: {
          "200": {
            description: "Lakehouse summary",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LakehouseSummary" },
              },
            },
          },
        },
      },
    },
    "/v1/ingest/jobs": {
      get: {
        operationId: "ingestListJobs",
        summary: "List ingest schedule jobs",
        parameters: [...TENANCY_HEADER_PARAMS],
        responses: {
          "200": {
            description: "Job list",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
        },
      },
      post: {
        operationId: "ingestStartJob",
        summary: "Start an ingest job",
        parameters: [...TENANCY_HEADER_PARAMS],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["sourceId"],
                properties: { sourceId: { type: "string" } },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Job started",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
        },
      },
    },
    "/v1/ingest/jobs/{id}": {
      get: {
        operationId: "ingestGetJob",
        summary: "Get ingest job status",
        parameters: [
          ...TENANCY_HEADER_PARAMS,
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Job status",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
        },
      },
    },
    "/v1/ingest/sources/{sourceId}/run": {
      post: {
        operationId: "ingestRunSource",
        summary: "Run ingest pipeline for a configured source",
        parameters: [
          ...TENANCY_HEADER_PARAMS,
          {
            name: "sourceId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Pipeline result",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
        },
      },
    },
    "/v1/ingest/records": {
      post: {
        operationId: "ingestRecords",
        summary: "Ingest entity records",
        parameters: [...TENANCY_HEADER_PARAMS],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/IngestRecordsRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Ingest outcome",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
        },
      },
    },
    "/v1/query/ask": {
      post: {
        operationId: "queryAsk",
        summary: "Natural-language ontology query",
        parameters: [...TENANCY_HEADER_PARAMS],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/QueryAskRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Query result",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
        },
      },
    },
    "/v1/products/customer-gpt/chat": {
      post: {
        operationId: "customerGptChat",
        summary: "Customer GPT chat with ontology grounding",
        parameters: [
          ...TENANCY_HEADER_PARAMS,
          { name: "x-session-id", in: "header", schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CustomerGptChatRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Assistant reply and citations",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
        },
      },
    },
    "/v1/policy/check": {
      post: {
        operationId: "policyCheck",
        summary: "Evaluate action/resource against policy",
        parameters: [...TENANCY_HEADER_PARAMS],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PolicyCheckRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Policy decision",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PolicyDecision" },
              },
            },
          },
        },
      },
    },
    "/v1/analytics/search": {
      get: {
        operationId: "analyticsSearchReport",
        summary: "Search entities and return an analytics report",
        parameters: [
          ...TENANCY_HEADER_PARAMS,
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "ontologyId", in: "query", schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer" } },
          { name: "property", in: "query", schema: { type: "string" } },
          { name: "propertyValue", in: "query", schema: { type: "string" } },
          { name: "reportTitle", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Analytics report",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AnalyticsReport" },
              },
            },
          },
        },
      },
    },
    "/v1/analytics/entities": {
      get: {
        operationId: "analyticsSearchEntities",
        summary: "Search entities (raw records)",
        parameters: [
          ...TENANCY_HEADER_PARAMS,
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "ontologyId", in: "query", schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer" } },
          { name: "property", in: "query", schema: { type: "string" } },
          { name: "propertyValue", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Matching entity records",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/EntityRecord" },
                },
              },
            },
          },
        },
      },
    },
    "/v1/analytics/dashboard": {
      get: {
        operationId: "analyticsDashboard",
        summary: "Build a dashboard spec for an ontology",
        parameters: [
          ...TENANCY_HEADER_PARAMS,
          { name: "ontologyId", in: "query", schema: { type: "string" } },
          { name: "breakdownField", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Dashboard specification",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DashboardSpec" },
              },
            },
          },
        },
      },
    },
    "/v1/analytics/lakehouse-summary": {
      get: {
        operationId: "analyticsLakehouseSummary",
        summary: "Lakehouse bronze change summary report",
        parameters: [
          ...TENANCY_HEADER_PARAMS,
          { name: "since", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "reportTitle", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Lakehouse analytics report",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LakehouseAnalyticsReport" },
              },
            },
          },
        },
      },
    },
    "/v1/automations/run": {
      post: {
        operationId: "automationsRun",
        summary: "Run workflow steps and optionally commit a write loop",
        parameters: [...TENANCY_HEADER_PARAMS],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AutomationsRunRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Workflow and optional loop outcome",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AutomationRunResult" },
              },
            },
          },
        },
      },
    },
    "/v1/automations/evaluate": {
      post: {
        operationId: "automationsEvaluate",
        summary: "Evaluate approval requirements for a patch",
        parameters: [...TENANCY_HEADER_PARAMS],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AutomationsEvaluateRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Approval decision",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApprovalDecision" },
              },
            },
          },
        },
      },
    },
    "/v1/automations/approve": {
      post: {
        operationId: "automationsApprove",
        summary: "Commit an approval-gated write loop",
        parameters: [...TENANCY_HEADER_PARAMS],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AutomationsApproveRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Loop committed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/WriteResult" },
              },
            },
          },
        },
      },
    },
    "/v1/ingest/schedules": {
      get: {
        operationId: "listIngestSchedules",
        summary: "List cron ingest schedules for the tenant/domain scope",
        parameters: [...TENANCY_HEADER_PARAMS],
        responses: {
          "200": {
            description: "Schedule rows",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GenericObject" },
              },
            },
          },
        },
      },
      post: {
        operationId: "createIngestSchedule",
        summary: "Create a cron ingest schedule",
        parameters: [...TENANCY_HEADER_PARAMS],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/GenericObject" },
            },
          },
        },
        responses: {
          "201": {
            description: "Schedule created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GenericObject" },
              },
            },
          },
        },
      },
    },
    "/v1/ingest/schedules/{id}": {
      patch: {
        operationId: "patchIngestSchedule",
        summary: "Update an ingest schedule",
        parameters: [
          ...TENANCY_HEADER_PARAMS,
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/GenericObject" },
            },
          },
        },
        responses: {
          "200": {
            description: "Schedule updated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GenericObject" },
              },
            },
          },
        },
      },
    },
    "/v1/ingest/listeners/{listenerId}/events": {
      post: {
        operationId: "ingestListenerEvents",
        summary: "Batch listener ingress",
        parameters: [
          ...TENANCY_HEADER_PARAMS,
          {
            name: "listenerId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/GenericObject" },
            },
          },
        },
        responses: {
          "200": {
            description: "Ingest outcome",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GenericObject" },
              },
            },
          },
        },
      },
    },
    "/v1/ingest/agents/heartbeat": {
      post: {
        operationId: "ingestAgentHeartbeat",
        summary: "Agent worker heartbeat",
        requestBody: {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/GenericObject" },
            },
          },
        },
        responses: {
          "200": {
            description: "Heartbeat ack",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GenericObject" },
              },
            },
          },
        },
      },
    },
    "/v1/ingest/webhooks/{sourceId}": {
      post: {
        operationId: "ingestWebhook",
        summary: "Push webhook payload into ingest pipeline",
        parameters: [
          ...TENANCY_HEADER_PARAMS,
          {
            name: "sourceId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/GenericObject" },
            },
          },
        },
        responses: {
          "202": {
            description: "Accepted for ingest",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GenericObject" },
              },
            },
          },
        },
      },
    },
    "/v1/data-health/summary": {
      get: {
        operationId: "dataHealthSummary",
        summary: "Aggregated data health (sources, schedules, lakehouse freshness)",
        parameters: [...TENANCY_HEADER_PARAMS],
        responses: {
          "200": {
            description: "Health summary",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GenericObject" },
              },
            },
          },
        },
      },
    },
    "/v1/lakehouse/export": {
      post: {
        operationId: "startLakehouseExport",
        summary: "Start async lakehouse dataset export (JSONL MVP)",
        parameters: [...TENANCY_HEADER_PARAMS],
        requestBody: {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/GenericObject" },
            },
          },
        },
        responses: {
          "202": {
            description: "Export job accepted",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GenericObject" },
              },
            },
          },
        },
      },
    },
    "/v1/lakehouse/exports/{exportId}": {
      get: {
        operationId: "getLakehouseExport",
        summary: "Poll lakehouse export job status",
        parameters: [
          ...TENANCY_HEADER_PARAMS,
          {
            name: "exportId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Export status",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GenericObject" },
              },
            },
          },
        },
      },
    },
    "/v1/media/objects": {
      get: {
        operationId: "listMediaObjects",
        summary: "List registered media object metadata",
        parameters: [...TENANCY_HEADER_PARAMS],
        responses: {
          "200": {
            description: "Media rows",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GenericObject" },
              },
            },
          },
        },
      },
      post: {
        operationId: "registerMediaObject",
        summary: "Register a media object URI",
        parameters: [...TENANCY_HEADER_PARAMS],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/GenericObject" },
            },
          },
        },
        responses: {
          "201": {
            description: "Media registered",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GenericObject" },
              },
            },
          },
        },
      },
    },
    "/v1/ontology/pack-resolution": {
      get: {
        operationId: "ontologyPackResolution",
        summary: "Resolve ontology pack for tenant/domain/branch",
        parameters: [
          ...TENANCY_HEADER_PARAMS,
          { name: "environment", in: "query", schema: { type: "string" } },
          { name: "packBranch", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Pack resolution",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GenericObject" },
              },
            },
          },
        },
      },
    },
    "/v1/pipelines/{pipelineId}/run": {
      post: {
        operationId: "runPipeline",
        summary: "Execute a pipeline-builder DAG",
        parameters: [
          ...TENANCY_HEADER_PARAMS,
          {
            name: "pipelineId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/GenericObject" },
            },
          },
        },
        responses: {
          "200": {
            description: "Pipeline run result",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GenericObject" },
              },
            },
          },
        },
      },
    },
    "/v1/evals/run": {
      post: {
        operationId: "runEvals",
        summary: "Run an AIP eval suite",
        parameters: [...TENANCY_HEADER_PARAMS],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/GenericObject" },
            },
          },
        },
        responses: {
          "200": {
            description: "Eval run result",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GenericObject" },
              },
            },
          },
        },
      },
    },
    "/v1/evals/runs": {
      get: {
        operationId: "listEvalRuns",
        summary: "List recent eval runs",
        parameters: [...TENANCY_HEADER_PARAMS],
        responses: {
          "200": {
            description: "Eval runs",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GenericObject" },
              },
            },
          },
        },
      },
    },
    "/v1/evals/record": {
      post: {
        operationId: "recordEval",
        summary: "Record a single eval event (persisted when Postgres configured)",
        parameters: [...TENANCY_HEADER_PARAMS],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/GenericObject" },
            },
          },
        },
        responses: {
          "200": {
            description: "Eval record",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GenericObject" },
              },
            },
          },
        },
      },
    },
    "/v1/agents/sessions": {
      post: {
        operationId: "createAgentSession",
        summary: "Create agent session",
        parameters: [...TENANCY_HEADER_PARAMS],
        requestBody: {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/GenericObject" },
            },
          },
        },
        responses: {
          "200": {
            description: "Session",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GenericObject" },
              },
            },
          },
        },
      },
    },
    "/v1/agents/sessions/{sessionId}/tools": {
      post: {
        operationId: "invokeAgentTool",
        summary: "Invoke tool in agent session",
        parameters: [
          ...TENANCY_HEADER_PARAMS,
          {
            name: "sessionId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/GenericObject" },
            },
          },
        },
        responses: {
          "200": {
            description: "Tool result",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GenericObject" },
              },
            },
          },
        },
      },
    },
    "/v1/functions/{functionId}/invoke": {
      post: {
        operationId: "invokeFunction",
        summary: "Invoke registered function",
        parameters: [
          ...TENANCY_HEADER_PARAMS,
          {
            name: "functionId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/GenericObject" },
            },
          },
        },
        responses: {
          "200": {
            description: "Function result",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GenericObject" },
              },
            },
          },
        },
      },
    },
    "/v1/admin/status": {
      get: {
        operationId: "adminStatus",
        summary: "Internal admin status",
        parameters: [...TENANCY_HEADER_PARAMS],
        responses: {
          "200": {
            description: "Status",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GenericObject" },
              },
            },
          },
        },
      },
    },
    "/v1/ops/health": {
      get: {
        operationId: "opsHealth",
        summary: "Platform ops health",
        responses: {
          "200": {
            description: "Health",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GenericObject" },
              },
            },
          },
        },
      },
    },
    "/v1/ops/connectors": {
      get: {
        operationId: "opsConnectors",
        summary: "Connector catalog status",
        parameters: [...TENANCY_HEADER_PARAMS],
        responses: {
          "200": {
            description: "Connectors",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GenericObject" },
              },
            },
          },
        },
      },
    },
    "/v1/ops/jobs": {
      get: {
        operationId: "opsJobs",
        summary: "Scheduled ingest jobs",
        parameters: [...TENANCY_HEADER_PARAMS],
        responses: {
          "200": {
            description: "Jobs",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GenericObject" },
              },
            },
          },
        },
      },
    },
    "/v1/governance/pack/promote": {
      post: {
        operationId: "promotePack",
        summary: "Promote ontology pack between environments",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/GenericObject" },
            },
          },
        },
        responses: {
          "200": {
            description: "Promotion result",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GenericObject" },
              },
            },
          },
        },
      },
    },
    "/v1/governance/pack/validate-change": {
      post: {
        operationId: "validatePackSchemaChange",
        summary: "Evaluate a proposed pack/schema change against governance policies",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SchemaChangeRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Gate evaluation result",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SchemaChangeGate" },
              },
            },
          },
        },
      },
    },
    "/v1/write": {
      post: {
        operationId: "writeEntity",
        summary: "Apply a patch to an entity",
        parameters: [...TENANCY_HEADER_PARAMS],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/WriteCommand" },
            },
          },
        },
        responses: {
          "200": {
            description: "Write committed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/WriteResult" },
              },
            },
          },
          "404": {
            description: "Entity not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
  },
  components: {
    parameters: {
      DaemonTenantHeader: {
        name: "X-Daemon-Tenant",
        in: "header",
        required: false,
        schema: { type: "string", default: "default" },
        description:
          "Tenant id from configs/tenancy.yaml (e.g. default, inst-alpha, ent-beta).",
      },
      DaemonDomainHeader: {
        name: "X-Daemon-Domain",
        in: "header",
        required: false,
        schema: { type: "string", default: "foundation" },
        description:
          "Domain id from configs/ontology/domains/catalog.yaml; must be enabled for the tenant on the gateway.",
      },
    },
    schemas: {
      Health: {
        type: "object",
        required: ["status"],
        properties: { status: { type: "string", enum: ["ok"] } },
      },
      GenericObject: {
        type: "object",
        additionalProperties: true,
      },
      EntityRecord: {
        type: "object",
        required: ["entityId", "ontologyId", "properties", "version", "updatedAt"],
        properties: {
          entityId: { type: "string" },
          ontologyId: { type: "string" },
          entityType: { type: "string" },
          properties: { type: "object", additionalProperties: true },
          version: { type: "integer" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      EntityListPage: {
        type: "object",
        required: ["items", "nextCursor"],
        properties: {
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/EntityRecord" },
          },
          nextCursor: { type: ["string", "null"] },
        },
      },
      SearchResponse: {
        type: "object",
        required: ["hits", "count"],
        properties: {
          hits: {
            type: "array",
            items: { type: "object", additionalProperties: true },
          },
          count: { type: "integer" },
        },
      },
      LakehouseSummary: {
        type: "object",
        properties: {
          entityTypeCounts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                entityType: { type: "string" },
                count: { type: "integer" },
              },
            },
          },
          changeVolumeByDay: {
            type: "array",
            items: {
              type: "object",
              properties: {
                day: { type: "string", format: "date-time" },
                changeType: { type: "string" },
                count: { type: "integer" },
              },
            },
          },
          window: {
            type: "object",
            properties: {
              since: { type: "string", format: "date-time" },
            },
          },
        },
      },
      LakehouseAnalyticsReport: {
        type: "object",
        properties: {
          title: { type: "string" },
          generatedAt: { type: "string", format: "date-time" },
          totalEvents: { type: "integer" },
          summary: { $ref: "#/components/schemas/LakehouseSummary" },
        },
      },
      IngestRecordsRequest: {
        type: "object",
        properties: {
          sourceId: { type: "string" },
          ontologyId: { type: "string" },
          entityId: { type: "string" },
          entityType: { type: "string" },
          properties: { type: "object", additionalProperties: true },
          records: {
            type: "array",
            items: { type: "object", additionalProperties: true },
          },
        },
      },
      QueryAskRequest: {
        type: "object",
        required: ["question"],
        properties: {
          question: { type: "string" },
          ontologyId: { type: "string" },
        },
      },
      CustomerGptChatRequest: {
        type: "object",
        required: ["turns"],
        properties: {
          ontologyId: { type: "string" },
          limit: { type: "integer" },
          turns: {
            type: "array",
            items: {
              type: "object",
              required: ["role", "content"],
              properties: {
                role: { type: "string", enum: ["user", "assistant"] },
                content: { type: "string" },
              },
            },
          },
        },
      },
      PolicyCheckRequest: {
        type: "object",
        required: ["action", "resource"],
        properties: {
          action: { type: "string" },
          resource: { type: "string" },
        },
      },
      PolicyDecision: {
        type: "object",
        required: ["allowed"],
        properties: {
          allowed: { type: "boolean" },
          reason: { type: "string" },
        },
      },
      WriteCommand: {
        type: "object",
        required: ["entityId", "ontologyId", "patch"],
        properties: {
          entityId: { type: "string" },
          ontologyId: { type: "string" },
          patch: { type: "object", additionalProperties: true },
          idempotencyKey: { type: "string" },
        },
      },
      WriteResult: {
        type: "object",
        required: ["writeId", "status", "version"],
        properties: {
          writeId: { type: "string" },
          status: { type: "string", enum: ["committed"] },
          version: { type: "integer" },
        },
      },
      Error: {
        type: "object",
        required: ["code", "message"],
        properties: {
          code: { type: "string" },
          message: { type: "string" },
        },
      },
      AnalyticsReport: {
        type: "object",
        required: ["id", "title", "rowCount", "columns", "rows"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          rowCount: { type: "integer" },
          columns: { type: "array", items: { type: "string" } },
          rows: { type: "array", items: { type: "object", additionalProperties: true } },
        },
      },
      DashboardSpec: {
        type: "object",
        required: ["ontologyId", "widgets"],
        properties: {
          ontologyId: { type: "string" },
          widgets: {
            type: "array",
            items: {
              type: "object",
              required: ["id", "title", "kind", "data"],
              properties: {
                id: { type: "string" },
                title: { type: "string" },
                kind: { type: "string" },
                data: { type: "object", additionalProperties: true },
              },
            },
          },
        },
      },
      AutomationsRunRequest: {
        type: "object",
        required: ["steps"],
        properties: {
          steps: {
            type: "array",
            items: {
              type: "object",
              required: ["id", "action"],
              properties: {
                id: { type: "string" },
                action: { type: "string" },
              },
            },
          },
          loop: { $ref: "#/components/schemas/WriteCommand" },
          loopFirst: {
            type: "boolean",
            description:
              "When true with loop, run write loop before workflow steps (LOOP then WF). Default false.",
          },
        },
      },
      AutomationsEvaluateRequest: {
        type: "object",
        required: ["patch"],
        properties: {
          patch: { type: "object", additionalProperties: true },
          approvals: { type: "array", items: { type: "string" } },
        },
      },
      AutomationsApproveRequest: {
        type: "object",
        required: ["loop", "approvals"],
        properties: {
          loop: { $ref: "#/components/schemas/WriteCommand" },
          approvals: { type: "array", items: { type: "string" } },
        },
      },
      AutomationRunResult: {
        type: "object",
        required: ["workflowResults"],
        properties: {
          workflowResults: { type: "array", items: { type: "string" } },
          loop: { $ref: "#/components/schemas/WriteResult" },
        },
      },
      ApprovalDecision: {
        type: "object",
        required: ["requiresApproval", "approved"],
        properties: {
          requiresApproval: { type: "boolean" },
          approved: { type: "boolean" },
          reasons: { type: "array", items: { type: "string" } },
        },
      },
      SchemaChangeRequest: {
        type: "object",
        required: ["packId"],
        properties: {
          packId: { type: "string" },
          proposedPackDir: {
            type: "string",
            description: "Relative path under configs/ontology/packs for proposed pack YAML",
          },
          proposedOverrides: {
            type: "object",
            properties: {
              entities: {
                type: "object",
                additionalProperties: {
                  type: "object",
                  properties: {
                    fields: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          type: { type: "string" },
                          required: { type: "boolean" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          changeType: {
            type: "string",
            enum: [
              "field_add",
              "field_remove",
              "type_rename",
              "relation_add",
              "relation_remove",
              "junction_add",
              "junction_remove",
            ],
          },
          breaking: { type: "boolean" },
          semverBump: { type: "string", enum: ["major", "minor", "patch"] },
          approvals: { type: "array", items: { type: "string" } },
        },
      },
      PackDiffSummary: {
        type: "object",
        properties: {
          breaking: { type: "boolean" },
          semverBump: { type: "string", enum: ["major", "minor", "patch"] },
          changes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                changeType: { type: "string" },
                entityType: { type: "string" },
                field: { type: "string" },
                detail: { type: "string" },
              },
            },
          },
        },
      },
      SchemaChangeGate: {
        type: "object",
        required: ["allowed", "auditAction"],
        properties: {
          allowed: { type: "boolean" },
          reason: { type: "string" },
          obligations: { type: "array", items: { type: "string" } },
          auditAction: {
            type: "string",
            enum: ["ontology.schema.change", "ontology.schema.change.pending"],
          },
          diff: { $ref: "#/components/schemas/PackDiffSummary" },
        },
      },
    },
  },
} as const;
