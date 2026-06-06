import type { PolicyDecision } from "@daemon/platform-types";

export interface EntityRecord {
  entityId: string;
  ontologyId: string;
  entityType?: string;
  properties: Record<string, unknown>;
  version: number;
  updatedAt: string;
}

export interface EntityListPage {
  items: EntityRecord[];
  nextCursor: string | null;
}

export interface SearchHit {
  entityId?: string;
  score?: number;
  snippet?: string;
  properties?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SearchResponse {
  hits: SearchHit[];
  count: number;
}

export interface WriteReceipt {
  writeId: string;
  status: string;
  version?: number;
}

export interface BronzeEntityTypeCountRow {
  entityType: string;
  count: number;
}

export interface BronzeChangeVolumeRow {
  day: string;
  changeType: string;
  count: number;
}

export interface LakehouseSummary {
  entityTypeCounts: BronzeEntityTypeCountRow[];
  changeVolumeByDay: BronzeChangeVolumeRow[];
  window: { since?: string };
}

export interface LakehouseAnalyticsReport {
  title: string;
  generatedAt: string;
  totalEvents: number;
  summary: LakehouseSummary;
}

export type LakehouseChangeType = "register" | "patch";

export interface LakehouseEventsParams {
  since?: string;
  limit?: number;
  entityType?: string;
  ontologyId?: string;
  changeType?: LakehouseChangeType;
}

export interface IngestRecordInput {
  ontologyId: string;
  entityId?: string;
  entityType?: string;
  properties?: Record<string, unknown>;
}

export interface IngestScheduleInput {
  sourceId: string;
  cronExpr: string;
  enabled?: boolean;
}

export interface IngestScheduleRecord extends IngestScheduleInput {
  id: string;
  tenantId: string;
  domainId: string;
  lastRunAt?: string | null;
  lastStatus?: string | null;
}

export interface LakehouseExportRequest {
  since?: string;
  limit?: number;
  format?: "jsonl" | "parquet";
}

export interface DataHealthSummary {
  generatedAt: string;
  sources?: unknown[];
  schedules?: unknown[];
  lakehouse?: unknown;
  searchIndexSize?: number;
  [key: string]: unknown;
}

export interface MediaObjectInput {
  uri: string;
  checksum?: string;
  mimeType?: string;
  sizeBytes?: number;
  metadata?: Record<string, unknown>;
}

export interface PackResolution {
  tenantId: string;
  domainId: string;
  packBranch?: string;
  environment?: string;
  packId: string;
  packVersion: string;
  entityTypes: string[];
}

export interface PipelineRunRequest {
  dag: {
    nodes: Array<{
      id: string;
      type: string;
      config?: Record<string, unknown>;
    }>;
  };
}

export interface EvalSuiteInput {
  id: string;
  cases: Array<{
    id: string;
    question: string;
    expectContains?: string[];
  }>;
}

export interface IngestRecordsRequest {
  sourceId?: string;
  ontologyId?: string;
  entityId?: string;
  entityType?: string;
  properties?: Record<string, unknown>;
  records?: IngestRecordInput[];
}

export interface QueryAskRequest {
  question: string;
  ontologyId?: string;
}

export interface CustomerGptTurn {
  role: "user" | "assistant";
  content: string;
}

export interface CustomerGptChatRequest {
  turns: CustomerGptTurn[];
  ontologyId?: string;
  limit?: number;
}

export interface CustomerGptChatResponse {
  reply?: string;
  citations?: unknown[];
  sessionId?: string;
  [key: string]: unknown;
}

export interface AutomationsRunRequest {
  steps: { id: string; action: string }[];
  loop?: {
    entityId: string;
    ontologyId: string;
    patch: Record<string, unknown>;
    idempotencyKey?: string;
  };
  loopFirst?: boolean;
}

export interface AutomationsEvaluateRequest {
  patch: Record<string, unknown>;
  approvals?: string[];
}

export interface AutomationsApproveRequest {
  loop: {
    entityId: string;
    ontologyId: string;
    patch: Record<string, unknown>;
    idempotencyKey?: string;
  };
  approvals: string[];
}

export interface ShadowPricingSimulationRequest {
  ontologyId?: string;
  shipmentRef?: string;
  limit?: number;
}

export interface ClickHouseStatusRow {
  status: string;
  count: number;
}

export interface ShadowPricingSimulationResult {
  mode: "clickhouse" | "ontology-only";
  generatedAt: string;
  shipmentRef?: string;
  clickhouse?: {
    database: string;
    table: string;
    statusBreakdown: ClickHouseStatusRow[];
    totalRows: number;
  };
  routingDecisions: {
    count: number;
    items: { entityId: string; decisionType?: string; shipmentRef?: string }[];
  };
  shipments: {
    count: number;
    items: { entityId: string; externalRef?: string; displayName?: string }[];
  };
  readOnly: true;
}

export type { PolicyDecision };
