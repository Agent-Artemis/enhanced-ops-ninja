-- ===========================================================================
-- Precomputed national rates for the deck generator.
--
-- WHY: deck_top_tags computed the national benchmark live — count(distinct ccn)
-- grouped by tag across 418k SNF rows (plus lab and hhh) on every page view.
-- That exceeded the PostgREST statement timeout, so the deck 404'd.
--
-- The national rate only changes when a new survey file is ingested, so it has
-- no business being recomputed per request. This materialises it once.
-- Refresh after any ingest:  select deck_refresh_national();
-- ===========================================================================

drop materialized view if exists deck_natl_rates cascade;

create materialized view deck_natl_rates as
with snf_c as (select (max(survey_date) - interval '3 years')::date d from snf_deficiencies),
     lab_c as (select (max(survey_date) - interval '3 years')::date d from lab_deficiencies),
     hhh_c as (select (max(survey_date) - interval '3 years')::date d from hhh_citations)
select 'snf'::text as sector, d.deficiency_tag as tag,
       count(distinct d.ccn)::bigint as facilities,
       (select count(distinct ccn) from snf_deficiencies where survey_date >= (select d from snf_c))::bigint as denom
from snf_deficiencies d where d.survey_date >= (select d from snf_c) group by d.deficiency_tag
union all
select 'lab', d.deficiency_tag, count(distinct d.ccn)::bigint,
       (select count(distinct ccn) from lab_deficiencies
         where survey_date >= (select d from lab_c)
           and (tag_description is null or tag_description not ilike 'Initial Comments%'))::bigint
from lab_deficiencies d
where d.survey_date >= (select d from lab_c)
  and (d.tag_description is null or d.tag_description not ilike 'Initial Comments%')
group by d.deficiency_tag
union all
select c.provider_type, c.tag_number, count(distinct c.ccn)::bigint,
       (select count(distinct ccn) from hhh_citations h
         where h.provider_type = c.provider_type and h.survey_date >= (select d from hhh_c)
           and (h.tag_description is null or h.tag_description not ilike 'Initial Comments%'))::bigint
from hhh_citations c
where c.survey_date >= (select d from hhh_c)
  and (c.tag_description is null or c.tag_description not ilike 'Initial Comments%')
group by c.provider_type, c.tag_number;

create unique index deck_natl_rates_pk on deck_natl_rates (sector, tag);

create or replace function deck_refresh_national() returns void
language sql security definer as $$
  refresh materialized view concurrently deck_natl_rates;
$$;
