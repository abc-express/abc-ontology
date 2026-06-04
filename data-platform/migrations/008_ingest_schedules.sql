-- Scheduled ingest definitions (cron-driven gateway worker)
CREATE TABLE IF NOT EXISTS daemon_ingest_schedules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  domain_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  cron_expr TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  last_status TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingest_schedules_enabled
  ON daemon_ingest_schedules (enabled) WHERE enabled = true;
