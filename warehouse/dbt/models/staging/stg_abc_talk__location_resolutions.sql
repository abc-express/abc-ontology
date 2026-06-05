select
    id::varchar as source_pk,
    'abc-talk' as source_system,
    coalesce(resolved_name, raw_name) as location_name,
    confidence::numeric(5, 4) as confidence_score,
    current_timestamp as _loaded_at
from {{ source('raw_abc_talk', 'location_resolutions') }}
