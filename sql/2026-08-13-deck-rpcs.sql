-- ===========================================================================
-- Deck generator RPCs — powers /tools/deck, /deck/* and /onepager/*
-- ===========================================================================
-- One query layer over five datasets that do NOT share a shape:
--   snf, lab, home_health, hospice  -> federal tag regimes. Comparable across
--                                      states, so a national benchmark is valid.
--   assisted_living                 -> licensed state by state under each
--                                      state's own rules. A "national rate" is
--                                      MEANINGLESS here (Utah's rule set is not
--                                      Oregon's), so natl_pct is returned NULL
--                                      and the deck must omit the comparison
--                                      rather than invent one.
--
-- p_sector is matched against a fixed allowlist below; there is no dynamic SQL,
-- so this cannot be injected through.
-- ===========================================================================

drop function if exists deck_headline(text, text);
create function deck_headline(p_sector text, p_state text)
returns table (
  facilities   bigint,
  citations    bigint,
  avg_per      numeric,
  ij           bigint,
  complaint    bigint,
  from_date    date,
  to_date      date,
  has_national boolean
)
language plpgsql stable as $$
declare cutoff date;
begin
  if p_sector = 'snf' then
    select (max(survey_date) - interval '3 years')::date into cutoff from snf_deficiencies;
    return query
      select count(distinct d.ccn), count(*)::bigint,
             round(count(*)::numeric / nullif(count(distinct d.ccn),0), 1),
             count(*) filter (where d.is_immediate_jeopardy),
             count(*) filter (where d.is_complaint),
             min(d.survey_date), max(d.survey_date), true
      from snf_deficiencies d
      where d.state = p_state and d.survey_date >= cutoff;

  elsif p_sector = 'lab' then
    select (max(survey_date) - interval '3 years')::date into cutoff from lab_deficiencies;
    return query
      select count(distinct d.ccn), count(*)::bigint,
             round(count(*)::numeric / nullif(count(distinct d.ccn),0), 1),
             0::bigint,
             count(*) filter (where d.is_complaint),
             min(d.survey_date), max(d.survey_date), true
      from lab_deficiencies d
      where d.state = p_state and d.survey_date >= cutoff
        and (d.tag_description is null or d.tag_description not ilike 'Initial Comments%');

  elsif p_sector in ('home_health','hospice') then
    select (max(survey_date) - interval '3 years')::date into cutoff from hhh_citations;
    return query
      select count(distinct c.ccn), count(*)::bigint,
             round(count(*)::numeric / nullif(count(distinct c.ccn),0), 1),
             count(*) filter (where c.tag_category = 'Condition'),
             count(*) filter (where c.survey_type ilike '%complaint%'),
             min(c.survey_date), max(c.survey_date), true
      from hhh_citations c
      where c.state = p_state and c.provider_type = p_sector and c.survey_date >= cutoff
        and (c.tag_description is null or c.tag_description not ilike 'Initial Comments%');

  elsif p_sector = 'assisted_living' then
    -- no survey_date on this table; all available records, and no national benchmark
    return query
      select count(distinct a.facility_id), count(*)::bigint,
             round(count(*)::numeric / nullif(count(distinct a.facility_id),0), 1),
             0::bigint,
             count(*) filter (where a.is_complaint_driven),
             null::date, null::date, false
      from al_deficiencies a
      where a.state = p_state;
  end if;
end;
$$;

drop function if exists deck_top_tags(text, text, integer);
create function deck_top_tags(p_sector text, p_state text, p_limit integer default 10)
returns table (
  tag        text,
  descr      text,
  facilities bigint,
  citations  bigint,
  ij         bigint,
  complaint  bigint,
  state_pct  numeric,
  natl_pct   numeric
)
language plpgsql stable as $$
declare cutoff date; denom bigint; natl_denom bigint;
begin
  if p_sector = 'snf' then
    select (max(survey_date) - interval '3 years')::date into cutoff from snf_deficiencies;
    select count(distinct ccn) into denom from snf_deficiencies where state=p_state and survey_date>=cutoff;
    select count(distinct ccn) into natl_denom from snf_deficiencies where survey_date>=cutoff;
    return query
      with st as (
        select d.deficiency_tag t, mode() within group (order by d.tag_description) de,
               count(distinct d.ccn) f, count(*)::bigint c,
               count(*) filter (where d.is_immediate_jeopardy) j,
               count(*) filter (where d.is_complaint) cm
        from snf_deficiencies d where d.state=p_state and d.survey_date>=cutoff
        group by 1),
      nt as (
        select d.deficiency_tag t, count(distinct d.ccn) f
        from snf_deficiencies d where d.survey_date>=cutoff group by 1)
      select st.t, st.de, st.f, st.c, st.j, st.cm,
             round(st.f*100.0/nullif(denom,0)), round(nt.f*100.0/nullif(natl_denom,0))
      from st left join nt on nt.t = st.t
      order by st.f desc, st.c desc limit p_limit;

  elsif p_sector = 'lab' then
    select (max(survey_date) - interval '3 years')::date into cutoff from lab_deficiencies;
    select count(distinct ccn) into denom from lab_deficiencies where state=p_state and survey_date>=cutoff;
    select count(distinct ccn) into natl_denom from lab_deficiencies where survey_date>=cutoff;
    return query
      with st as (
        select d.deficiency_tag t, mode() within group (order by d.tag_description) de,
               count(distinct d.ccn) f, count(*)::bigint c, 0::bigint j,
               count(*) filter (where d.is_complaint) cm
        from lab_deficiencies d
        where d.state=p_state and d.survey_date>=cutoff
          and (d.tag_description is null or d.tag_description not ilike 'Initial Comments%')
        group by 1),
      nt as (
        select d.deficiency_tag t, count(distinct d.ccn) f
        from lab_deficiencies d
        where d.survey_date>=cutoff
          and (d.tag_description is null or d.tag_description not ilike 'Initial Comments%')
        group by 1)
      select st.t, st.de, st.f, st.c, st.j, st.cm,
             round(st.f*100.0/nullif(denom,0)), round(nt.f*100.0/nullif(natl_denom,0))
      from st left join nt on nt.t = st.t
      order by st.f desc, st.c desc limit p_limit;

  elsif p_sector in ('home_health','hospice') then
    select (max(survey_date) - interval '3 years')::date into cutoff from hhh_citations;
    select count(distinct ccn) into denom from hhh_citations
      where state=p_state and provider_type=p_sector and survey_date>=cutoff;
    select count(distinct ccn) into natl_denom from hhh_citations
      where provider_type=p_sector and survey_date>=cutoff;
    return query
      with st as (
        select c.tag_number t, mode() within group (order by c.tag_description) de,
               count(distinct c.ccn) f, count(*)::bigint c2,
               count(*) filter (where c.tag_category='Condition') j,
               count(*) filter (where c.survey_type ilike '%complaint%') cm
        from hhh_citations c
        where c.state=p_state and c.provider_type=p_sector and c.survey_date>=cutoff
          and (c.tag_description is null or c.tag_description not ilike 'Initial Comments%')
        group by 1),
      nt as (
        select c.tag_number t, count(distinct c.ccn) f
        from hhh_citations c
        where c.provider_type=p_sector and c.survey_date>=cutoff
          and (c.tag_description is null or c.tag_description not ilike 'Initial Comments%')
        group by 1)
      select st.t, st.de, st.f, st.c2, st.j, st.cm,
             round(st.f*100.0/nullif(denom,0)), round(nt.f*100.0/nullif(natl_denom,0))
      from st left join nt on nt.t = st.t
      order by st.f desc, st.c2 desc limit p_limit;

  elsif p_sector = 'assisted_living' then
    select count(distinct facility_id) into denom from al_deficiencies where state=p_state;
    return query
      select coalesce(a.rule_section,'—')::text, a.rule_title::text,
             count(distinct a.facility_id), count(*)::bigint, 0::bigint,
             count(*) filter (where a.is_complaint_driven),
             round(count(distinct a.facility_id)*100.0/nullif(denom,0)),
             null::numeric                      -- state-specific rules: no valid national rate
      from al_deficiencies a
      where a.state = p_state and a.rule_title is not null
      group by a.rule_section, a.rule_title
      order by count(distinct a.facility_id) desc, count(*) desc limit p_limit;
  end if;
end;
$$;

drop function if exists deck_states(text);
create function deck_states(p_sector text)
returns table (state text, n bigint)
language plpgsql stable as $$
begin
  if p_sector='snf' then
    return query select d.state, count(*)::bigint from snf_deficiencies d
      where d.state is not null group by 1 order by 1;
  elsif p_sector='lab' then
    return query select d.state, count(*)::bigint from lab_deficiencies d
      where d.state is not null group by 1 order by 1;
  elsif p_sector in ('home_health','hospice') then
    return query select c.state, count(*)::bigint from hhh_citations c
      where c.provider_type=p_sector and c.state is not null group by 1 order by 1;
  elsif p_sector='assisted_living' then
    return query select a.state, count(*)::bigint from al_deficiencies a
      where a.state is not null group by 1 order by 1;
  end if;
end;
$$;
