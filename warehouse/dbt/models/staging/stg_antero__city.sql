-- Staging: Antero city/province normalization (read-only extract).
select
    id::varchar as source_pk,
    'antero' as source_system,
    name as city_name,
    null::varchar as province_name,
    null::varchar as kab_kota_code,
    current_timestamp as _loaded_at
from {{ source('raw_antero', 'city') }}
