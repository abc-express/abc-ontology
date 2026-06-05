select
    coverage_id,
    location_id,
    coverage_status,
    serving_ro,
    serving_agent,
    sla_hours,
    is_3t,
    source_system,
    updated_at
from {{ ref('stg_antero__kantor_coverage_kota') }}
