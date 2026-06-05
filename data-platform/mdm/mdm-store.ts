import { randomUUID } from "node:crypto";
import type { PostgresClient } from "../operational-store/postgres-client.js";
import type {
  CanonicalLocation,
  LocationMatchResult,
  ServiceAreaCoverage,
  SourceLocationRecord,
} from "./location-matcher.js";
import { LocationMatcher } from "./location-matcher.js";
import { normalizeLocationName } from "./location-normalizer.js";

export type ConflictRow = {
  conflictId: string;
  entityType: string;
  canonicalId: string | null;
  fieldName: string;
  sourceA: string;
  valueA: string | null;
  sourceB: string;
  valueB: string | null;
  severity: string;
  resolutionStatus: string;
  createdAt: string;
};

export type AuditEventInput = {
  requestId?: string;
  actorType: "user" | "system" | "ai_agent" | "integration";
  actorId: string;
  actionCode: string;
  entityType: string;
  entityId: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  reasonCode?: string;
  approvalId?: string;
  sourceSystem?: string;
  idempotencyKey?: string;
};

export type ActionResult = {
  actionId: string;
  status: "committed" | "duplicate";
  entityType: string;
  entityId: string;
  auditEventId: string;
  outboxEventId?: number;
};

export class MdmStore {
  private readonly matcher = new LocationMatcher();

  constructor(private readonly pg: PostgresClient) {}

  async ensureSchema(): Promise<void> {
    // Schema owned by migrations; no-op for runtime callers.
  }

  async seedPilotLocations(locations: CanonicalLocation[]): Promise<void> {
    for (const loc of locations) {
      this.matcher.register(loc);
      await this.pg.query(
        `INSERT INTO abc_core.entity_registry
           (canonical_id, entity_type, human_id, canonical_name, properties)
         VALUES ($1, 'Location', $2, $3, $4::jsonb)
         ON CONFLICT (canonical_id) DO UPDATE
           SET canonical_name = EXCLUDED.canonical_name,
               properties = EXCLUDED.properties,
               updated_at = NOW()`,
        [
          loc.locationId,
          loc.kabKotaCode ?? loc.locationId,
          loc.canonicalName,
          JSON.stringify({
            provinceName: loc.provinceName,
            kabKotaCode: loc.kabKotaCode,
            bpsCode: loc.bpsCode,
          }),
        ],
      );
      await this.pg.query(
        `INSERT INTO abc_core.core_locations
           (location_id, location_type, canonical_name, province_name, province_code,
            kab_kota_code, bps_code, confidence_score)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 1.0)
         ON CONFLICT (location_id) DO UPDATE
           SET canonical_name = EXCLUDED.canonical_name,
               province_name = EXCLUDED.province_name,
               updated_at = NOW()`,
        [
          loc.locationId,
          loc.locationType,
          loc.canonicalName,
          loc.provinceName ?? null,
          loc.provinceCode ?? null,
          loc.kabKotaCode ?? null,
          loc.bpsCode ?? null,
        ],
      );
      for (const alias of loc.aliases) {
        await this.pg.query(
          `INSERT INTO abc_core.core_location_aliases
             (location_id, alias, alias_normalized, source_system, confidence_score)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (alias_normalized, source_system) DO NOTHING`,
          [
            loc.locationId,
            alias.alias,
            normalizeLocationName(alias.alias),
            alias.sourceSystem,
            alias.confidenceScore,
          ],
        );
      }
    }
  }

  async loadMatcherFromDb(): Promise<LocationMatcher> {
    const matcher = new LocationMatcher();
    const locRes = await this.pg.query<{
      location_id: string;
      location_type: CanonicalLocation["locationType"];
      canonical_name: string;
      province_name: string | null;
      province_code: string | null;
      kab_kota_code: string | null;
      bps_code: string | null;
    }>(`SELECT location_id, location_type, canonical_name, province_name,
               province_code, kab_kota_code, bps_code
        FROM abc_core.core_locations
        WHERE status = 'active'`);

    for (const row of locRes.rows) {
      const aliasRes = await this.pg.query<{
        alias: string;
        source_system: string;
        confidence_score: string;
      }>(
        `SELECT alias, source_system, confidence_score::text
         FROM abc_core.core_location_aliases WHERE location_id = $1`,
        [row.location_id],
      );
      matcher.register({
        locationId: row.location_id,
        locationType: row.location_type,
        canonicalName: row.canonical_name,
        provinceName: row.province_name ?? undefined,
        provinceCode: row.province_code ?? undefined,
        kabKotaCode: row.kab_kota_code ?? undefined,
        bpsCode: row.bps_code ?? undefined,
        aliases: aliasRes.rows.map((a) => ({
          alias: a.alias,
          sourceSystem: a.source_system,
          confidenceScore: Number(a.confidence_score),
        })),
      });
    }
    return matcher;
  }

  async ingestSourceLocation(record: SourceLocationRecord): Promise<{
    match: LocationMatchResult;
    mappingId?: number;
    conflictId?: string;
  }> {
    const matcher = await this.loadMatcherFromDb();
    const match = matcher.match(record);

    if (match.canonical) {
      const mapRes = await this.pg.query<{ id: number }>(
        `INSERT INTO abc_core.source_entity_mappings
           (entity_type, source_system, source_pk, canonical_id, match_method, confidence_score)
         VALUES ('Location', $1, $2, $3, $4, $5)
         ON CONFLICT (entity_type, source_system, source_pk) DO UPDATE
           SET canonical_id = EXCLUDED.canonical_id,
               match_method = EXCLUDED.match_method,
               confidence_score = EXCLUDED.confidence_score,
               last_seen_at = NOW()
         RETURNING id`,
        [
          record.sourceSystem,
          record.sourcePk,
          match.canonical.locationId,
          match.matchMethod,
          match.confidenceScore,
        ],
      );
      const mappingId = mapRes.rows[0]?.id;

      let conflictId: string | undefined;
      if (matcher.needsManualReview(match) && match.conflict) {
        conflictId = await this.openConflict({
          entityType: "Location",
          canonicalId: match.canonical.locationId,
          fieldName: match.conflict.fieldName,
          sourceA: match.conflict.sourceA,
          valueA: match.conflict.valueA,
          sourceB: match.conflict.sourceB,
          valueB: match.conflict.valueB,
          severity: match.conflict.severity,
        });
      }
      return { match, mappingId, conflictId };
    }

    const conflictId = await this.openConflict({
      entityType: "Location",
      canonicalId: null,
      fieldName: "canonical_name",
      sourceA: record.sourceSystem,
      valueA: record.name,
      sourceB: "canonical",
      valueB: null,
      severity: "high",
    });
    return { match, conflictId };
  }

  async openConflict(input: {
    entityType: string;
    canonicalId: string | null;
    fieldName: string;
    sourceA: string;
    valueA: string | null;
    sourceB: string;
    valueB: string | null;
    severity: "low" | "medium" | "high" | "critical";
  }): Promise<string> {
    const conflictId = `conflict-${randomUUID()}`;
    await this.pg.query(
      `INSERT INTO abc_core.entity_conflicts
         (conflict_id, entity_type, canonical_id, field_name,
          source_a, value_a, source_b, value_b, severity)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        conflictId,
        input.entityType,
        input.canonicalId,
        input.fieldName,
        input.sourceA,
        input.valueA,
        input.sourceB,
        input.valueB,
        input.severity,
      ],
    );
    await this.enqueueOutbox("location.conflict_detected", "Location", input.canonicalId ?? conflictId, {
      conflictId,
      fieldName: input.fieldName,
      sourceA: input.sourceA,
      valueA: input.valueA,
      sourceB: input.sourceB,
      valueB: input.valueB,
    });
    return conflictId;
  }

  async listLocations(limit = 100): Promise<CanonicalLocation[]> {
    const matcher = await this.loadMatcherFromDb();
    const locRes = await this.pg.query<{ location_id: string }>(
      `SELECT location_id FROM abc_core.core_locations
       WHERE status = 'active' ORDER BY canonical_name LIMIT $1`,
      [limit],
    );
    const out: CanonicalLocation[] = [];
    for (const row of locRes.rows) {
      const m = matcher.match({
        sourceSystem: "canonical",
        sourcePk: row.location_id,
        name: row.location_id,
        kabKotaCode: row.location_id.replace(/^LOC-/, ""),
      });
      if (m.canonical) out.push(m.canonical);
    }
    return out;
  }

  async listServiceAreas(limit = 100): Promise<ServiceAreaCoverage[]> {
    const res = await this.pg.query<{
      coverage_id: string;
      location_id: string;
      coverage_status: ServiceAreaCoverage["coverageStatus"];
      serving_ro: string | null;
      serving_agent: string | null;
      sla_hours: number | null;
      is_3t: boolean;
      source_system: string;
    }>(
      `SELECT coverage_id, location_id, coverage_status, serving_ro, serving_agent,
              sla_hours, is_3t, source_system
       FROM abc_core.core_service_area_coverage
       WHERE coverage_status = 'active'
       ORDER BY coverage_id LIMIT $1`,
      [limit],
    );
    return res.rows.map((r) => ({
      coverageId: r.coverage_id,
      locationId: r.location_id,
      coverageStatus: r.coverage_status,
      servingRo: r.serving_ro ?? undefined,
      servingAgent: r.serving_agent ?? undefined,
      slaHours: r.sla_hours ?? undefined,
      is3t: r.is_3t,
      sourceSystem: r.source_system,
    }));
  }

  async listOpenConflicts(entityType?: string, limit = 50): Promise<ConflictRow[]> {
    const res = await this.pg.query<{
      conflict_id: string;
      entity_type: string;
      canonical_id: string | null;
      field_name: string;
      source_a: string;
      value_a: string | null;
      source_b: string;
      value_b: string | null;
      severity: string;
      resolution_status: string;
      created_at: Date;
    }>(
      entityType
        ? `SELECT conflict_id, entity_type, canonical_id, field_name,
                  source_a, value_a, source_b, value_b, severity,
                  resolution_status, created_at
           FROM abc_core.entity_conflicts
           WHERE resolution_status = 'open' AND entity_type = $2
           ORDER BY created_at DESC LIMIT $1`
        : `SELECT conflict_id, entity_type, canonical_id, field_name,
                  source_a, value_a, source_b, value_b, severity,
                  resolution_status, created_at
           FROM abc_core.entity_conflicts
           WHERE resolution_status = 'open'
           ORDER BY created_at DESC LIMIT $1`,
      entityType ? [limit, entityType] : [limit],
    );
    return res.rows.map((r) => ({
      conflictId: r.conflict_id,
      entityType: r.entity_type,
      canonicalId: r.canonical_id,
      fieldName: r.field_name,
      sourceA: r.source_a,
      valueA: r.value_a,
      sourceB: r.source_b,
      valueB: r.value_b,
      severity: r.severity,
      resolutionStatus: r.resolution_status,
      createdAt: r.created_at.toISOString(),
    }));
  }

  async appendAudit(input: AuditEventInput): Promise<{ auditEventId: string; duplicate: boolean }> {
    if (input.idempotencyKey) {
      const existing = await this.pg.query<{ audit_event_id: string }>(
        `SELECT audit_event_id::text FROM abc_core.audit_events
         WHERE idempotency_key = $1 LIMIT 1`,
        [input.idempotencyKey],
      );
      if (existing.rows[0]) {
        return { auditEventId: existing.rows[0].audit_event_id, duplicate: true };
      }
    }
    const res = await this.pg.query<{ audit_event_id: string }>(
      `INSERT INTO abc_core.audit_events
         (request_id, actor_type, actor_id, action_code, entity_type, entity_id,
          before_state, after_state, reason_code, approval_id, source_system, idempotency_key)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11, $12)
       RETURNING audit_event_id::text`,
      [
        input.requestId ?? null,
        input.actorType,
        input.actorId,
        input.actionCode,
        input.entityType,
        input.entityId,
        input.beforeState ? JSON.stringify(input.beforeState) : null,
        input.afterState ? JSON.stringify(input.afterState) : null,
        input.reasonCode ?? null,
        input.approvalId ?? null,
        input.sourceSystem ?? "ontology_api",
        input.idempotencyKey ?? null,
      ],
    );
    return { auditEventId: res.rows[0]!.audit_event_id, duplicate: false };
  }

  async enqueueOutbox(
    eventType: string,
    aggregateType: string,
    aggregateId: string,
    payload: Record<string, unknown>,
  ): Promise<number> {
    const res = await this.pg.query<{ event_id: number }>(
      `INSERT INTO abc_core.outbox_events (event_type, aggregate_type, aggregate_id, payload)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING event_id`,
      [eventType, aggregateType, aggregateId, JSON.stringify(payload)],
    );
    return res.rows[0]!.event_id;
  }

  async resolveLocationConflict(input: {
    conflictId: string;
    canonicalId: string;
    resolvedValue: string;
    actorId: string;
    reasonCode?: string;
    idempotencyKey?: string;
  }): Promise<ActionResult> {
    const conflictRes = await this.pg.query<{
      entity_type: string;
      canonical_id: string | null;
      field_name: string;
      value_a: string | null;
      resolution_status: string;
    }>(
      `SELECT entity_type, canonical_id, field_name, value_a, resolution_status
       FROM abc_core.entity_conflicts WHERE conflict_id = $1`,
      [input.conflictId],
    );
    const conflict = conflictRes.rows[0];
    if (!conflict) throw new Error(`conflict not found: ${input.conflictId}`);
    if (conflict.resolution_status !== "open") {
      throw new Error(`conflict already ${conflict.resolution_status}`);
    }

    const audit = await this.appendAudit({
      actorType: "user",
      actorId: input.actorId,
      actionCode: "resolve_location_conflict",
      entityType: "Location",
      entityId: input.canonicalId,
      beforeState: {
        conflictId: input.conflictId,
        fieldName: conflict.field_name,
        priorValue: conflict.value_a,
      },
      afterState: { resolvedValue: input.resolvedValue },
      reasonCode: input.reasonCode ?? "steward_resolution",
      idempotencyKey: input.idempotencyKey,
    });
    if (audit.duplicate && input.idempotencyKey) {
      return {
        actionId: input.idempotencyKey,
        status: "duplicate",
        entityType: "Location",
        entityId: input.canonicalId,
        auditEventId: audit.auditEventId,
      };
    }

    await this.pg.query(
      `UPDATE abc_core.entity_conflicts
       SET resolution_status = 'resolved',
           resolved_by = $2,
           resolved_at = NOW(),
           suggested_value = $3
       WHERE conflict_id = $1`,
      [input.conflictId, input.actorId, input.resolvedValue],
    );

    const outboxId = await this.enqueueOutbox("location.resolved", "Location", input.canonicalId, {
      conflictId: input.conflictId,
      resolvedValue: input.resolvedValue,
    });

    return {
      actionId: `action-${audit.auditEventId}`,
      status: "committed",
      entityType: "Location",
      entityId: input.canonicalId,
      auditEventId: audit.auditEventId,
      outboxEventId: outboxId,
    };
  }

  async updateServiceAreaCoverage(
    input: ServiceAreaCoverage & {
      actorId: string;
      reasonCode?: string;
      idempotencyKey?: string;
    },
  ): Promise<ActionResult> {
    const beforeRes = await this.pg.query(
      `SELECT * FROM abc_core.core_service_area_coverage WHERE coverage_id = $1`,
      [input.coverageId],
    );
    const before = beforeRes.rows[0] as Record<string, unknown> | undefined;

    const audit = await this.appendAudit({
      actorType: "user",
      actorId: input.actorId,
      actionCode: "update_service_area_coverage",
      entityType: "ServiceAreaCoverage",
      entityId: input.coverageId,
      beforeState: before,
      afterState: input as unknown as Record<string, unknown>,
      reasonCode: input.reasonCode ?? "coverage_update",
      idempotencyKey: input.idempotencyKey,
    });
    if (audit.duplicate && input.idempotencyKey) {
      return {
        actionId: input.idempotencyKey,
        status: "duplicate",
        entityType: "ServiceAreaCoverage",
        entityId: input.coverageId,
        auditEventId: audit.auditEventId,
      };
    }

    await this.pg.query(
      `INSERT INTO abc_core.core_service_area_coverage
         (coverage_id, location_id, coverage_status, serving_ro, serving_agent,
          sla_hours, is_3t, source_system)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (coverage_id) DO UPDATE
         SET coverage_status = EXCLUDED.coverage_status,
             serving_ro = EXCLUDED.serving_ro,
             serving_agent = EXCLUDED.serving_agent,
             sla_hours = EXCLUDED.sla_hours,
             is_3t = EXCLUDED.is_3t,
             updated_at = NOW()`,
      [
        input.coverageId,
        input.locationId,
        input.coverageStatus,
        input.servingRo ?? null,
        input.servingAgent ?? null,
        input.slaHours ?? null,
        input.is3t ?? false,
        input.sourceSystem ?? "antero",
      ],
    );

    const outboxId = await this.enqueueOutbox(
      "service_area.coverage_updated",
      "ServiceAreaCoverage",
      input.coverageId,
      { coverageId: input.coverageId, locationId: input.locationId },
    );

    return {
      actionId: `action-${audit.auditEventId}`,
      status: "committed",
      entityType: "ServiceAreaCoverage",
      entityId: input.coverageId,
      auditEventId: audit.auditEventId,
      outboxEventId: outboxId,
    };
  }

  async createSignal(input: {
    signalId: string;
    signalType: string;
    severity: string;
    accountRef?: string;
    actorId: string;
    idempotencyKey?: string;
  }): Promise<ActionResult> {
    const audit = await this.appendAudit({
      actorType: "system",
      actorId: input.actorId,
      actionCode: "create_signal",
      entityType: "Signal",
      entityId: input.signalId,
      afterState: input,
      reasonCode: "signal_created",
      idempotencyKey: input.idempotencyKey,
    });
    if (audit.duplicate && input.idempotencyKey) {
      return {
        actionId: input.idempotencyKey,
        status: "duplicate",
        entityType: "Signal",
        entityId: input.signalId,
        auditEventId: audit.auditEventId,
      };
    }
    const outboxId = await this.enqueueOutbox("signal.created", "Signal", input.signalId, input);
    return {
      actionId: `action-${audit.auditEventId}`,
      status: "committed",
      entityType: "Signal",
      entityId: input.signalId,
      auditEventId: audit.auditEventId,
      outboxEventId: outboxId,
    };
  }
}
