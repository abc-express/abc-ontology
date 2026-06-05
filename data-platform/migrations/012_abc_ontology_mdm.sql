-- ABC Express ontology MDM layer (Phase 0-1 pilot)
-- Canonical entities, source mappings, conflict queue, audit/outbox for operational actions.

CREATE SCHEMA IF NOT EXISTS abc_core;

-- ---------------------------------------------------------------------------
-- Entity registry
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS abc_core.entity_registry (
  canonical_id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  human_id TEXT,
  canonical_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'merged', 'split')),
  lifecycle_state TEXT NOT NULL DEFAULT 'current'
    CHECK (lifecycle_state IN ('current', 'superseded', 'proposed')),
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_to TIMESTAMPTZ,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entity_registry_type_status
  ON abc_core.entity_registry (entity_type, status);

-- ---------------------------------------------------------------------------
-- Source entity mappings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS abc_core.source_entity_mappings (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,
  source_system TEXT NOT NULL,
  source_database TEXT,
  source_schema TEXT DEFAULT 'public',
  source_table TEXT,
  source_pk TEXT NOT NULL,
  canonical_id TEXT NOT NULL REFERENCES abc_core.entity_registry (canonical_id),
  match_method TEXT NOT NULL,
  confidence_score NUMERIC(5, 4) NOT NULL DEFAULT 1.0000
    CHECK (confidence_score >= 0 AND confidence_score <= 1),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_type, source_system, source_pk)
);

CREATE INDEX IF NOT EXISTS idx_source_mappings_canonical
  ON abc_core.source_entity_mappings (canonical_id);

-- ---------------------------------------------------------------------------
-- Conflict queue
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS abc_core.entity_conflicts (
  conflict_id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  canonical_id TEXT REFERENCES abc_core.entity_registry (canonical_id),
  field_name TEXT NOT NULL,
  source_a TEXT NOT NULL,
  value_a TEXT,
  source_b TEXT NOT NULL,
  value_b TEXT,
  suggested_value TEXT,
  severity TEXT NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  steward_owner TEXT,
  resolution_status TEXT NOT NULL DEFAULT 'open'
    CHECK (resolution_status IN ('open', 'in_review', 'resolved', 'dismissed')),
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entity_conflicts_open
  ON abc_core.entity_conflicts (resolution_status, entity_type)
  WHERE resolution_status = 'open';

-- ---------------------------------------------------------------------------
-- Survivorship rules (reference data; enforced in application layer)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS abc_core.survivorship_rules (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,
  field_name TEXT NOT NULL,
  priority_order JSONB NOT NULL DEFAULT '[]'::jsonb,
  fallback_rule TEXT,
  manual_review_threshold NUMERIC(5, 4) NOT NULL DEFAULT 0.9000,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_to TIMESTAMPTZ,
  UNIQUE (entity_type, field_name, effective_from)
);

-- ---------------------------------------------------------------------------
-- Operational audit events (distinct from daemon_audit policy log)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS abc_core.audit_events (
  audit_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID,
  actor_type TEXT NOT NULL
    CHECK (actor_type IN ('user', 'system', 'ai_agent', 'integration')),
  actor_id TEXT NOT NULL,
  action_code TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before_state JSONB,
  after_state JSONB,
  reason_code TEXT,
  approval_id TEXT,
  source_system TEXT NOT NULL DEFAULT 'ontology_api',
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_events_idempotency
  ON abc_core.audit_events (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_events_entity
  ON abc_core.audit_events (entity_type, entity_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Outbox for downstream warehouse / notification consumers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS abc_core.outbox_events (
  event_id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'published', 'failed')),
  retry_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending
  ON abc_core.outbox_events (status, created_at)
  WHERE status = 'pending';

-- ---------------------------------------------------------------------------
-- Canonical location pilot tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS abc_core.core_locations (
  location_id TEXT PRIMARY KEY,
  location_type TEXT NOT NULL DEFAULT 'kab_kota'
    CHECK (location_type IN ('provinsi', 'kab_kota', 'kecamatan', 'kelurahan', 'alias')),
  canonical_name TEXT NOT NULL,
  province_name TEXT,
  province_code TEXT,
  kab_kota_code TEXT,
  bps_code TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  confidence_score NUMERIC(5, 4) NOT NULL DEFAULT 1.0000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS abc_core.core_location_aliases (
  id BIGSERIAL PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES abc_core.core_locations (location_id),
  alias TEXT NOT NULL,
  alias_normalized TEXT NOT NULL,
  source_system TEXT NOT NULL,
  confidence_score NUMERIC(5, 4) NOT NULL DEFAULT 1.0000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (alias_normalized, source_system)
);

CREATE INDEX IF NOT EXISTS idx_location_aliases_lookup
  ON abc_core.core_location_aliases (alias_normalized);

CREATE TABLE IF NOT EXISTS abc_core.core_service_area_coverage (
  coverage_id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES abc_core.core_locations (location_id),
  coverage_status TEXT NOT NULL DEFAULT 'active'
    CHECK (coverage_status IN ('active', 'inactive', 'pending', 'suspended')),
  serving_ro TEXT,
  serving_agent TEXT,
  sla_hours INT,
  is_3t BOOLEAN NOT NULL DEFAULT FALSE,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_to TIMESTAMPTZ,
  source_system TEXT NOT NULL DEFAULT 'antero',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_area_location
  ON abc_core.core_service_area_coverage (location_id, coverage_status);
