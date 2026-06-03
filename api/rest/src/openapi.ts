/**
 * OpenAPI 3.1 description of the REST surface. This mirrors the gateway's
 * read/write contract so the same handlers can be validated against a single
 * schema in {@link file://../../../tests/contract/api-contract.test.ts}.
 */
export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Daemon REST API",
    version: "0.1.0",
    description: "Read/write access to the Daemon ontology registry over HTTP.",
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
        operationId: "readEntity",
        summary: "Resolve an entity by id",
        parameters: [
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
            schema: { type: "string", default: "default" },
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
    "/v1/analytics/search": {
      get: {
        operationId: "analyticsSearchReport",
        summary: "Search entities and return an analytics report",
        parameters: [
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
    "/v1/automations/run": {
      post: {
        operationId: "automationsRun",
        summary: "Run workflow steps and optionally commit a write loop",
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
    "/v1/write": {
      post: {
        operationId: "writeEntity",
        summary: "Apply a patch to an entity",
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
    schemas: {
      Health: {
        type: "object",
        required: ["status"],
        properties: { status: { type: "string", enum: ["ok"] } },
      },
      EntityRecord: {
        type: "object",
        required: ["entityId", "ontologyId", "properties", "version", "updatedAt"],
        properties: {
          entityId: { type: "string" },
          ontologyId: { type: "string" },
          properties: { type: "object", additionalProperties: true },
          version: { type: "integer" },
          updatedAt: { type: "string", format: "date-time" },
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
    },
  },
} as const;
