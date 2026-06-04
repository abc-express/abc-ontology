-- Tables created after 003_rls_app_role may lack daemon_app grants when owned by the migrator role.

GRANT SELECT, INSERT, UPDATE, DELETE ON daemon_lakehouse_bronze TO daemon_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON daemon_lakehouse_silver_entity TO daemon_app;
GRANT SELECT ON daemon_lakehouse_gold_entity_counts TO daemon_app;
GRANT SELECT ON daemon_lakehouse_gold_change_volume TO daemon_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON daemon_gpt_sessions TO daemon_app;
