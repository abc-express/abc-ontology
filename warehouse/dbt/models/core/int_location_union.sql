-- Union contributing location sources before canonical survivorship.
with antero as (
    select
        source_pk,
        source_system,
        city_name as raw_name,
        province_name,
        kab_kota_code,
        cast(null as numeric(5, 4)) as confidence_score
    from {{ ref('stg_antero__city') }}
),
talk as (
    select
        source_pk,
        source_system,
        location_name as raw_name,
        cast(null as varchar) as province_name,
        cast(null as varchar) as kab_kota_code,
        confidence_score
    from {{ ref('stg_abc_talk__location_resolutions') }}
),
cms as (
    select
        source_pk,
        source_system,
        area_name as raw_name,
        cast(null as varchar) as province_name,
        cast(null as varchar) as kab_kota_code,
        cast(0.85 as numeric(5, 4)) as confidence_score
    from {{ ref('stg_cms__areas') }}
)
select * from antero
union all
select * from talk
union all
select * from cms
