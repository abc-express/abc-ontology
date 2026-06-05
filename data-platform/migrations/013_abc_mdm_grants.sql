-- Grants for abc_core MDM tables (when daemon_app role exists from 003_rls_app_role).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'daemon_app') THEN
    GRANT USAGE ON SCHEMA abc_core TO daemon_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA abc_core TO daemon_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA abc_core TO daemon_app;
  END IF;
END $$;
