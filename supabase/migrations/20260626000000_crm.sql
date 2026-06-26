-- EnhancedOps CRM schema
-- Access restricted to @enhancedops.ninja emails and jeff@augeo-hq.com

-- Helper: check if JWT email is allowed
create or replace function crm_allowed()
returns boolean language sql stable as $$
  select (
    auth.jwt() ->> 'email' like '%@enhancedops.ninja'
    or auth.jwt() ->> 'email' = 'jeff@augeo-hq.com'
  )
$$;

-- ── Team members ─────────────────────────────────────────────────────────────
create table if not exists crm_team_members (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null unique,
  role        text,
  created_at  timestamptz default now()
);

alter table crm_team_members enable row level security;

create policy "team_members_select" on crm_team_members
  for select using (crm_allowed());
create policy "team_members_insert" on crm_team_members
  for insert with check (crm_allowed());
create policy "team_members_update" on crm_team_members
  for update using (crm_allowed());
create policy "team_members_delete" on crm_team_members
  for delete using (crm_allowed());

-- Seed Jeff
insert into crm_team_members (name, email, role)
values ('Jeff Oldroyd', 'jeff@augeo-hq.com', 'owner')
on conflict (email) do nothing;

-- ── Voice agents ─────────────────────────────────────────────────────────────
create table if not exists crm_voice_agents (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  persona             text,
  voice               text,
  call_instructions   text,
  text_instructions   text,
  email_instructions  text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

alter table crm_voice_agents enable row level security;

create policy "voice_agents_select" on crm_voice_agents
  for select using (crm_allowed());
create policy "voice_agents_insert" on crm_voice_agents
  for insert with check (crm_allowed());
create policy "voice_agents_update" on crm_voice_agents
  for update using (crm_allowed());
create policy "voice_agents_delete" on crm_voice_agents
  for delete using (crm_allowed());

-- ── Sequences ────────────────────────────────────────────────────────────────
create table if not exists crm_sequences (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  created_at  timestamptz default now()
);

alter table crm_sequences enable row level security;

create policy "sequences_select" on crm_sequences
  for select using (crm_allowed());
create policy "sequences_insert" on crm_sequences
  for insert with check (crm_allowed());
create policy "sequences_update" on crm_sequences
  for update using (crm_allowed());
create policy "sequences_delete" on crm_sequences
  for delete using (crm_allowed());

-- ── Stages ───────────────────────────────────────────────────────────────────
create table if not exists crm_stages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  position    int not null default 0,
  color       text default '#1A6ECC',
  created_at  timestamptz default now()
);

alter table crm_stages enable row level security;

create policy "stages_select" on crm_stages
  for select using (crm_allowed());
create policy "stages_insert" on crm_stages
  for insert with check (crm_allowed());
create policy "stages_update" on crm_stages
  for update using (crm_allowed());
create policy "stages_delete" on crm_stages
  for delete using (crm_allowed());

-- Seed stages
insert into crm_stages (name, position, color) values
  ('Lead',        0, '#64748b'),
  ('Contacted',   1, '#1A6ECC'),
  ('Qualified',   2, '#0891b2'),
  ('Proposal',    3, '#7c3aed'),
  ('Negotiation', 4, '#d97706'),
  ('Closed Won',  5, '#16a34a')
on conflict do nothing;

-- ── Contacts ─────────────────────────────────────────────────────────────────
create table if not exists crm_contacts (
  id               uuid primary key default gen_random_uuid(),
  first_name       text not null,
  last_name        text,
  company          text,
  email            text,
  phone            text,
  stage_id         uuid references crm_stages(id),
  assigned_to      uuid references crm_team_members(id),
  sequence_id      uuid references crm_sequences(id),
  voice_agent_id   uuid references crm_voice_agents(id),
  next_action_date date,
  date_entered     date default current_date,
  is_active        boolean default true,
  bucket           text default 'active' check (bucket in ('today','active','day','month','alpha')),
  bucket_day       int,   -- 1-31 for day bucket
  bucket_month     text,  -- e.g. 'Jul' for month bucket
  bucket_alpha     char,  -- A-Z for alpha bucket
  tags             text[],
  custom_fields    jsonb default '{}',
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

alter table crm_contacts enable row level security;

create policy "contacts_select" on crm_contacts
  for select using (crm_allowed());
create policy "contacts_insert" on crm_contacts
  for insert with check (crm_allowed());
create policy "contacts_update" on crm_contacts
  for update using (crm_allowed());
create policy "contacts_delete" on crm_contacts
  for delete using (crm_allowed());

-- ── Notes ────────────────────────────────────────────────────────────────────
create table if not exists crm_notes (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid not null references crm_contacts(id) on delete cascade,
  author_id   uuid references crm_team_members(id),
  body        text not null,
  created_at  timestamptz default now()
);

alter table crm_notes enable row level security;

create policy "notes_select" on crm_notes
  for select using (crm_allowed());
create policy "notes_insert" on crm_notes
  for insert with check (crm_allowed());
create policy "notes_update" on crm_notes
  for update using (crm_allowed());
create policy "notes_delete" on crm_notes
  for delete using (crm_allowed());

-- ── Auto-update updated_at ────────────────────────────────────────────────────
create or replace function crm_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger crm_contacts_updated_at
  before update on crm_contacts
  for each row execute function crm_touch_updated_at();

create trigger crm_voice_agents_updated_at
  before update on crm_voice_agents
  for each row execute function crm_touch_updated_at();
