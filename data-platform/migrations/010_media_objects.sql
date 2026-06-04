CREATE TABLE IF NOT EXISTS daemon_media_objects (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  domain_id TEXT NOT NULL,
  uri TEXT NOT NULL,
  checksum TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_objects_tenant
  ON daemon_media_objects (tenant_id, domain_id);
