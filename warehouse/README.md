# ABC Express analytical warehouse (dbt + Redshift)

Skeleton for Phase 2 warehouse foundation per the ontology implementation plan.

## Layout

```
warehouse/dbt/
  models/
    sources/     # raw_antero, raw_abc_talk, raw_obl, raw_cms
    staging/     # stg_* normalization
    core/        # core_locations, core_service_area_coverage
    marts/       # mart_operations__*, mart_obl__*
```

## Prerequisites

- Amazon S3 raw landing partitioned by `source_system/table/date`
- Redshift (or Serverless) database `abc_warehouse`
- Read-only Supabase credentials for CDC/batch extract

## Commands

```bash
cd warehouse/dbt
dbt deps
dbt debug --profiles-dir .
dbt run --profiles-dir .
dbt test --profiles-dir .
```

Operational MDM tables live in Postgres schema `abc_core` (migration `012_abc_ontology_mdm.sql`).
Sync from `abc_core` to Redshift `core` schema is a separate batch job (not yet wired).
