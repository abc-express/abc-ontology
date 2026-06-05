select
    id::varchar as source_pk,
    'cms' as source_system,
    name as area_name,
    current_timestamp as _loaded_at
from {{ source('raw_cms', 'areas') }}
