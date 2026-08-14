-- deck_top_tags, rewritten to read the precomputed national rates.
-- The state side stays live (it is small — one state's rows), the national side
-- comes from deck_natl_rates. Previously this recomputed the national aggregate
-- per request and blew the statement timeout.
drop function if exists deck_top_tags(text, text, integer);
create function deck_top_tags(p_sector text, p_state text, p_limit integer default 10)
returns table (
  tag text, descr text, facilities bigint, citations bigint,
  ij bigint, complaint bigint, state_pct numeric, natl_pct numeric
)
language plpgsql stable as $$
declare cutoff date; v_denom bigint;
begin
  if p_sector = 'snf' then
    select (max(survey_date) - interval '3 years')::date into cutoff from snf_deficiencies;
    select count(distinct ccn) into v_denom from snf_deficiencies where state=p_state and survey_date>=cutoff;
    return query
      select d.deficiency_tag::text,
             (mode() within group (order by d.tag_description))::text,
             count(distinct d.ccn), count(*)::bigint,
             count(*) filter (where d.is_immediate_jeopardy),
             count(*) filter (where d.is_complaint),
             round(count(distinct d.ccn)*100.0/nullif(v_denom,0)),
             max(round(n.facilities*100.0/nullif(n.denom,0)))
      from snf_deficiencies d
      left join deck_natl_rates n on n.sector='snf' and n.tag=d.deficiency_tag
      where d.state=p_state and d.survey_date>=cutoff
      group by d.deficiency_tag
      order by count(distinct d.ccn) desc, count(*) desc
      limit p_limit;

  elsif p_sector = 'lab' then
    select (max(survey_date) - interval '3 years')::date into cutoff from lab_deficiencies;
    select count(distinct ccn) into v_denom from lab_deficiencies
      where state=p_state and survey_date>=cutoff
        and (tag_description is null or tag_description not ilike 'Initial Comments%');
    return query
      select d.deficiency_tag::text,
             (mode() within group (order by d.tag_description))::text,
             count(distinct d.ccn), count(*)::bigint, 0::bigint,
             count(*) filter (where d.is_complaint),
             round(count(distinct d.ccn)*100.0/nullif(v_denom,0)),
             max(round(n.facilities*100.0/nullif(n.denom,0)))
      from lab_deficiencies d
      left join deck_natl_rates n on n.sector='lab' and n.tag=d.deficiency_tag
      where d.state=p_state and d.survey_date>=cutoff
        and (d.tag_description is null or d.tag_description not ilike 'Initial Comments%')
      group by d.deficiency_tag
      order by count(distinct d.ccn) desc, count(*) desc
      limit p_limit;

  elsif p_sector in ('home_health','hospice') then
    select (max(survey_date) - interval '3 years')::date into cutoff from hhh_citations;
    select count(distinct ccn) into v_denom from hhh_citations
      where state=p_state and provider_type=p_sector and survey_date>=cutoff
        and (tag_description is null or tag_description not ilike 'Initial Comments%');
    return query
      select c.tag_number::text,
             (mode() within group (order by c.tag_description))::text,
             count(distinct c.ccn), count(*)::bigint,
             count(*) filter (where c.tag_category='Condition'),
             count(*) filter (where c.survey_type ilike '%complaint%'),
             round(count(distinct c.ccn)*100.0/nullif(v_denom,0)),
             max(round(n.facilities*100.0/nullif(n.denom,0)))
      from hhh_citations c
      left join deck_natl_rates n on n.sector=p_sector and n.tag=c.tag_number
      where c.state=p_state and c.provider_type=p_sector and c.survey_date>=cutoff
        and (c.tag_description is null or c.tag_description not ilike 'Initial Comments%')
      group by c.tag_number
      order by count(distinct c.ccn) desc, count(*) desc
      limit p_limit;

  elsif p_sector = 'assisted_living' then
    select count(distinct facility_id) into v_denom from al_deficiencies where state=p_state;
    return query
      select coalesce(a.rule_section,'-')::text, a.rule_title::text,
             count(distinct a.facility_id), count(*)::bigint, 0::bigint,
             count(*) filter (where a.is_complaint_driven),
             round(count(distinct a.facility_id)*100.0/nullif(v_denom,0)),
             null::numeric
      from al_deficiencies a
      where a.state=p_state and a.rule_title is not null
      group by a.rule_section, a.rule_title
      order by count(distinct a.facility_id) desc, count(*) desc
      limit p_limit;
  end if;
end;
$$;
