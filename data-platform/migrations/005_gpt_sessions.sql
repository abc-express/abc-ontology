-- Customer GPT session citations (durable across gateway restarts)

CREATE TABLE IF NOT EXISTS daemon_gpt_sessions (
  tenant_id TEXT NOT NULL,
  domain_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  citations JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, domain_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_gpt_sessions_updated
  ON daemon_gpt_sessions (tenant_id, domain_id, updated_at DESC);

ALTER TABLE daemon_gpt_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daemon_gpt_sessions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS daemon_gpt_sessions_tenant ON daemon_gpt_sessions;
CREATE POLICY daemon_gpt_sessions_tenant ON daemon_gpt_sessions
  USING (tenant_id = current_setting('app.tenant_id', true));
