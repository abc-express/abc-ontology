-- Lakehouse silver: curated latest entity state; gold: analytics views

CREATE TABLE IF NOT EXISTS daemon_lakehouse_silver_entity (
  tenant_id TEXT NOT NULL,
  domain_id TEXT NOT NULL,
  ontology_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_type TEXT,
  properties JSONB NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  source_updated_at TIMESTAMPTZ,
  materialized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, domain_id, ontology_id, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_lakehouse_silver_scope_type
  ON daemon_lakehouse_silver_entity (tenant_id, domain_id, entity_type);

ALTER TABLE daemon_lakehouse_silver_entity ENABLE ROW LEVEL SECURITY;
ALTER TABLE daemon_lakehouse_silver_entity FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS daemon_lakehouse_silver_entity_tenant ON daemon_lakehouse_silver_entity;
CREATE POLICY daemon_lakehouse_silver_entity_tenant ON daemon_lakehouse_silver_entity
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE OR REPLACE VIEW daemon_lakehouse_gold_entity_counts AS
SELECT
  tenant_id,
  domain_id,
  COALESCE(entity_type, 'unknown') AS entity_type,
  COUNT(*)::bigint AS entity_count
FROM daemon_lakehouse_silver_entity
GROUP BY tenant_id, domain_id, COALESCE(entity_type, 'unknown');

CREATE OR REPLACE VIEW daemon_lakehouse_gold_change_volume AS
SELECT
  tenant_id,
  domain_id,
  date_trunc('day', indexed_at) AS day,
  COUNT(*)::bigint AS change_count
FROM daemon_lakehouse_bronze
GROUP BY tenant_id, domain_id, date_trunc('day', indexed_at);
