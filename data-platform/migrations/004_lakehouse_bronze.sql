-- Lakehouse bronze: append-only entity change trail for analytics and compliance

CREATE TABLE IF NOT EXISTS daemon_lakehouse_bronze (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  domain_id TEXT NOT NULL,
  ontology_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_type TEXT,
  change_type TEXT NOT NULL CHECK (change_type IN ('register', 'patch')),
  payload JSONB NOT NULL DEFAULT '{}',
  source TEXT,
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lakehouse_bronze_scope_at
  ON daemon_lakehouse_bronze (tenant_id, domain_id, indexed_at DESC);

ALTER TABLE daemon_lakehouse_bronze ENABLE ROW LEVEL SECURITY;
ALTER TABLE daemon_lakehouse_bronze FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS daemon_lakehouse_bronze_tenant ON daemon_lakehouse_bronze;
CREATE POLICY daemon_lakehouse_bronze_tenant ON daemon_lakehouse_bronze
  USING (tenant_id = current_setting('app.tenant_id', true));
