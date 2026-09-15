-- ═══════════════════════════════════════════════════════════════════════════
-- CRM REVENUE — open cases, projections, current income against target.
-- Supabase project tbjynbevrhkfzpswehsj. Written 2026-09-14.
--
-- ⛔ THIS IS JEFF'S MONEY. Every table below is readable and writable ONLY by a
--    revenue admin. It is deliberately NOT gated on crm_allowed(), which admits
--    every @enhancedops.ninja address.
--
-- ⚠️ WHY THERE IS A SEPARATE ADMIN TABLE rather than crm_team_members.role:
--    crm_team_members carries an UPDATE policy open to crm_allowed(), so any of
--    the ~19 team-domain users can write their OWN row's role to 'owner'. A gate
--    that reads that column is a gate the people it excludes can open.
--    crm_revenue_admins has RLS on and NO POLICIES AT ALL: nobody can read or
--    write it through the API. Only the service role / SQL editor changes it.
--
-- Re-runnable: every create is IF NOT EXISTS, policies are dropped first, and
-- the seed skips lines that already exist by name.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Who may see revenue ──────────────────────────────────────────────────────
create table if not exists public.crm_revenue_admins (
  email      text primary key,
  created_at timestamptz not null default now()
);
alter table public.crm_revenue_admins enable row level security;
-- (no policies — intentional; see header)

insert into public.crm_revenue_admins (email) values ('jeff@augeo-hq.com')
on conflict (email) do nothing;

-- SECURITY DEFINER so it can read crm_revenue_admins, which callers cannot.
-- search_path pinned so a caller cannot shadow the table with their own.
create or replace function public.crm_revenue_admin()
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (
    select 1 from public.crm_revenue_admins a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
$$;
revoke all on function public.crm_revenue_admin() from public;
grant execute on function public.crm_revenue_admin() to anon, authenticated;

-- ── Lines: one per client / deal ─────────────────────────────────────────────
create table if not exists public.crm_revenue_lines (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  contact_id    uuid references public.crm_contacts(id) on delete set null,
  product       text,
  status        text not null default 'verbal'
                check (status in ('live','signed','verbal','pending_decision','at_risk','lost')),
  -- recurring = the line continues after its last scheduled month.
  recurring     boolean not null default false,
  decision_date date,
  decision_note text,
  next_action   text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── Schedule: WHAT arrives WHEN ─────────────────────────────────────────────
-- ⭐ A SCHEDULE, NOT ONE NUMBER. Nate ramps month by month; Blake changes shape
--    in January. A single deal value cannot hold either.
create table if not exists public.crm_revenue_schedule (
  id       uuid primary key default gen_random_uuid(),
  line_id  uuid not null references public.crm_revenue_lines(id) on delete cascade,
  month    date not null check (extract(day from month) = 1),
  amount   numeric(12,2) not null check (amount >= 0),
  unique (line_id, month)
);
create index if not exists crm_revenue_schedule_month on public.crm_revenue_schedule (month);

-- ── Targets ──────────────────────────────────────────────────────────────────
-- month NULL = a STANDING monthly target with no date yet. Jeff stated $10,000 a
-- month but not WHEN he means to hit it, so the seed does not invent a date.
create table if not exists public.crm_revenue_targets (
  id            uuid primary key default gen_random_uuid(),
  month         date check (month is null or extract(day from month) = 1),
  target_amount numeric(12,2) not null check (target_amount >= 0),
  updated_at    timestamptz not null default now()
);
create unique index if not exists crm_revenue_targets_month   on public.crm_revenue_targets (month) where month is not null;
create unique index if not exists crm_revenue_targets_standing on public.crm_revenue_targets ((month is null)) where month is null;

-- ── Investments ──────────────────────────────────────────────────────────────
create table if not exists public.crm_investments (
  id          uuid primary key default gen_random_uuid(),
  investor    text not null,
  amount      numeric(12,2) not null check (amount >= 0),
  instrument  text not null default 'SAFE',
  status      text not null default 'verbal'
              check (status in ('live','signed','verbal','pending_decision','at_risk','lost')),
  accredited  text not null default 'unknown' check (accredited in ('yes','no','unknown')),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── RLS: revenue admins only, every table, every verb ────────────────────────
do $$
declare t text;
begin
  foreach t in array array['crm_revenue_lines','crm_revenue_schedule','crm_revenue_targets','crm_investments'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_select', t);
    execute format('drop policy if exists %I on public.%I', t||'_insert', t);
    execute format('drop policy if exists %I on public.%I', t||'_update', t);
    execute format('drop policy if exists %I on public.%I', t||'_delete', t);
    execute format('create policy %I on public.%I for select using (public.crm_revenue_admin())', t||'_select', t);
    execute format('create policy %I on public.%I for insert with check (public.crm_revenue_admin())', t||'_insert', t);
    execute format('create policy %I on public.%I for update using (public.crm_revenue_admin()) with check (public.crm_revenue_admin())', t||'_update', t);
    execute format('create policy %I on public.%I for delete using (public.crm_revenue_admin())', t||'_delete', t);
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- SEED — Jeff's figures as stated 2026-09-14, exactly.
-- ⛔ No invented statuses: everything except Payman is 'verbal' until Jeff
--    changes it. ⛔ No invented months: schedules stop where Jeff's figures stop.
-- CHECK (all lines landing): Sep 2,000 · Oct 24,100 · Nov 31,100 · Dec 58,100 ·
--                            Jan 57,100 · Feb 62,100.
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare lid uuid;
begin
  -- Payman — the only LIVE line
  if not exists (select 1 from crm_revenue_lines where name = 'Payman') then
    insert into crm_revenue_lines (name, status, recurring, notes)
    values ('Payman', 'live', true, '$2,000/mo, recurring, live from Sep 2026.')
    returning id into lid;
    insert into crm_revenue_schedule (line_id, month, amount)
    select lid, m::date, 2000 from generate_series('2026-09-01'::date, '2027-02-01', interval '1 month') m;
  end if;

  -- SAL Management Group — pending decision
  if not exists (select 1 from crm_revenue_lines where name = 'SAL Management Group') then
    insert into crm_revenue_lines (name, status, recurring, decision_date, decision_note, notes)
    values ('SAL Management Group', 'pending_decision', false, '2026-09-23',
            'Owners'' meeting on the 23rd, $475/location. ⚠️ Source is Jeff''s JOURNAL, not his calendar — confirm the date.',
            '$7,600/mo from Oct 2026. Recurring not stated — confirm with Jeff; schedule stops at Feb 2027 until he does.')
    returning id into lid;
    insert into crm_revenue_schedule (line_id, month, amount)
    select lid, m::date, 7600 from generate_series('2026-10-01'::date, '2027-02-01', interval '1 month') m;
  end if;

  -- Blake / BioVara — changes shape in January
  if not exists (select 1 from crm_revenue_lines where name = 'Blake / BioVara') then
    insert into crm_revenue_lines (name, product, status, recurring, notes)
    values ('Blake / BioVara', 'BioVara', 'verbal', false,
            '$12,000 Oct–Dec 2026, then $3,000/mo from Jan 2027 PLUS PROFIT SHARE — profit-share terms not agreed, not included in any figure. Recurring not stated — schedule stops at Feb 2027.')
    returning id into lid;
    insert into crm_revenue_schedule (line_id, month, amount) values
      (lid, '2026-10-01', 12000), (lid, '2026-11-01', 12000), (lid, '2026-12-01', 12000),
      (lid, '2027-01-01', 3000),  (lid, '2027-02-01', 3000);
  end if;

  -- Nate Hall / nexusletter.ninja — ramps month by month
  if not exists (select 1 from crm_revenue_lines where name = 'Nate Hall') then
    insert into crm_revenue_lines (name, product, status, recurring, notes)
    values ('Nate Hall', 'nexusletter.ninja', 'verbal', false,
            '⚠️ Whether $25,000 continues after Feb 2027 is UNCONFIRMED — the schedule deliberately stops at Feb.')
    returning id into lid;
    insert into crm_revenue_schedule (line_id, month, amount) values
      (lid, '2026-10-01', 2500),  (lid, '2026-11-01', 5000), (lid, '2026-12-01', 12000),
      (lid, '2027-01-01', 20000), (lid, '2027-02-01', 25000);
  end if;

  -- Kehler — dashboard build
  if not exists (select 1 from crm_revenue_lines where name = 'Kehler') then
    insert into crm_revenue_lines (name, product, status, recurring, notes)
    values ('Kehler', 'Dashboard build', 'verbal', true, '$2,000/mo from Nov 2026, recurring.')
    returning id into lid;
    insert into crm_revenue_schedule (line_id, month, amount)
    select lid, m::date, 2000 from generate_series('2026-11-01'::date, '2027-02-01', interval '1 month') m;
  end if;

  -- Sei / PACS Tampa — Jeff's conservative figure
  if not exists (select 1 from crm_revenue_lines where name = 'Sei / PACS Tampa') then
    insert into crm_revenue_lines (name, product, status, recurring, notes)
    values ('Sei / PACS Tampa', 'PACS Tampa', 'verbal', true, '$2,500/mo from Nov 2026, recurring — Jeff''s conservative figure.')
    returning id into lid;
    insert into crm_revenue_schedule (line_id, month, amount)
    select lid, m::date, 2500 from generate_series('2026-11-01'::date, '2027-02-01', interval '1 month') m;
  end if;

  -- Bryan Hamel
  if not exists (select 1 from crm_revenue_lines where name = 'Bryan Hamel') then
    insert into crm_revenue_lines (name, status, recurring, notes)
    values ('Bryan Hamel', 'verbal', true, '$20,000/mo from Dec 2026, recurring.')
    returning id into lid;
    insert into crm_revenue_schedule (line_id, month, amount)
    select lid, m::date, 20000 from generate_series('2026-12-01'::date, '2027-02-01', interval '1 month') m;
  end if;

  -- Investments — $50,000 each, SAFE, verbal. Accreditation unknown for all:
  -- Jeff stated it for Travis & Von and stated nothing for the rest.
  insert into crm_investments (investor, amount, instrument, status, accredited)
  select v.investor, 50000, 'SAFE', 'verbal', 'unknown'
  from (values ('Fedor'), ('Travis & Von'), ('Sei'), ('Nate'), ('Bryan')) v(investor)
  where not exists (select 1 from crm_investments i where i.investor = v.investor);

  -- Standing target — $10,000/month, NO DATE (Jeff sets it)
  if not exists (select 1 from crm_revenue_targets where month is null) then
    insert into crm_revenue_targets (month, target_amount) values (null, 10000);
  end if;
end $$;
