-- Canonical location publish layer (survivorship applied in warehouse job).
select
    coalesce(
        case when kab_kota_code is not null then 'LOC-' || kab_kota_code end,
        upper(source_system) || '-' || source_pk
    ) as location_id,
    case when kab_kota_code is not null then 'kab_kota' else 'alias' end as location_type,
    raw_name as canonical_name,
    province_name,
    cast(null as varchar) as province_code,
    kab_kota_code,
    kab_kota_code as bps_code,
    'active' as status,
    coalesce(confidence_score, 0.75) as confidence_score,
    current_timestamp as updated_at
from {{ ref('int_location_union') }}
