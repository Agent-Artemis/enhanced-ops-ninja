-- CRM activity tracking — outreach + meetings feeding the Reports dashboard.
-- Access restricted to @enhancedops.ninja emails and jeff@augeo-hq.com via crm_allowed().
--
-- contact_id is NULLABLE by design: pre-card outreach (e.g. LinkedIn DMs, cold
-- texts/calls) is logged for volume tracking BEFORE a prospect becomes an OCS
-- card. A card is created when they book via Cal.com; activity then attaches to it.

create table if not exists crm_activities (
  id           uuid primary key default gen_random_uuid(),
  contact_id   uuid references crm_contacts(id) on delete set null,
  kind         text not null check (kind in ('outreach','meeting')),
  -- outreach channel / meeting source
  platform     text not null default 'other'
                 check (platform in ('linkedin','facebook','instagram','x','phone','text','email','referral','in_person','other')),
  direction    text not null default 'outbound' check (direction in ('outbound','inbound')),
  -- meeting lifecycle outcome (null for outreach): booked → held/no_show/rescheduled → won/lost/follow_up
  outcome      text check (outcome in ('booked','held','no_show','rescheduled','won','lost','follow_up')),
  occurred_at  timestamptz not null default now(),
  body         text,
  author_id    uuid references crm_team_members(id),
  created_at   timestamptz default now()
);

create index if not exists crm_activities_occurred_at_idx on crm_activities (occurred_at desc);
create index if not exists crm_activities_kind_idx        on crm_activities (kind);
create index if not exists crm_activities_platform_idx    on crm_activities (platform);
create index if not exists crm_activities_contact_id_idx  on crm_activities (contact_id);

alter table crm_activities enable row level security;

create policy "activities_select" on crm_activities
  for select using (crm_allowed());
create policy "activities_insert" on crm_activities
  for insert with check (crm_allowed());
create policy "activities_update" on crm_activities
  for update using (crm_allowed());
create policy "activities_delete" on crm_activities
  for delete using (crm_allowed());
