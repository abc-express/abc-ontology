-- Fails when duplicate canonical location IDs would publish.
select location_id, count(*) as row_count
from {{ ref('core_locations') }}
group by location_id
having count(*) > 1
