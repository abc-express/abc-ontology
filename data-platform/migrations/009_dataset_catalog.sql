-- Dataset export catalog (Parquet / Iceberg locations)
CREATE TABLE IF NOT EXISTS daemon_dataset_catalog (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  domain_id TEXT NOT NULL,
  name TEXT NOT NULL,
  format TEXT NOT NULL,
  location_uri TEXT NOT NULL,
  refreshed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dataset_catalog_tenant
  ON daemon_dataset_catalog (tenant_id, domain_id);

CREATE TABLE IF NOT EXISTS daemon_lakehouse_exports (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  domain_id TEXT NOT NULL,
  status TEXT NOT NULL,
  format TEXT NOT NULL,
  location_uri TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
