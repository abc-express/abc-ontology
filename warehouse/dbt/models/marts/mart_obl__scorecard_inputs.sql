select
    s.id::varchar as scorecard_id,
    k.id::varchar as kpi_entry_id,
    k.metric_code,
    k.metric_value,
    current_timestamp as snapshot_at
from {{ source('raw_obl', 'scorecards') }} s
left join {{ source('raw_obl', 'kpi_entries') }} k on k.scorecard_id = s.id
