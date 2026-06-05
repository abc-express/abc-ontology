select
    id::varchar as coverage_id,
    city_id::varchar as location_id,
    'active' as coverage_status,
    cast(null as varchar) as serving_ro,
    cast(null as varchar) as serving_agent,
    cast(null as int) as sla_hours,
    false as is_3t,
    'antero' as source_system,
    current_timestamp as updated_at
from {{ source('raw_antero', 'kantor_coverage_kota') }}
