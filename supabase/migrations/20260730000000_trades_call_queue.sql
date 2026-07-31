-- AI Call Queue (Jason / Retell outbound) — worked from the CRM "Call Lists" tab.
--
-- Source of prospects: trades_outreach.leads (AI-callable business LANDLINES only,
-- flagged ai_callable = true by a separate tagging job). The daily loader cron
-- (/api/cron/call-list-loader) promotes fresh leads into this queue, topping it up
-- to a daily target (default 15). Lifecycle: queued → called → (snoozed | booked).
--
-- RLS is enabled with NO policies, so only the service-role key (server routes)
-- can touch it — the anon/authenticated browser client can never read or write it.
-- Every app read/write goes through /api/crm/call-queue (admin client + JWT guard).

create table if not exists trades_outreach.call_queue (
  id             bigint generated always as identity primary key,
  lead_id        bigint not null unique references trades_outreach.leads(id) on delete cascade,
  business_name  text,
  phone_e164     text,
  category       text,
  city           text,
  county         text,
  -- queued  : on the active call list, awaiting a dial
  -- called  : dialed at least once (last_outcome/last_call_at populated)
  -- snoozed : prospect said no / not now — hidden until snoozed_until passes, then auto re-queued
  -- booked  : Jason booked an appointment — removed from the list, flows into OCS (crm_contact_id)
  -- removed : manually dropped (bad number, not a fit)
  status         text not null default 'queued',
  queued_at      timestamptz not null default now(),
  last_call_at   timestamptz,
  last_outcome   text,
  retell_call_id text,
  snoozed_until  timestamptz,
  booked_at      timestamptz,
  crm_contact_id uuid,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists call_queue_status_idx on trades_outreach.call_queue(status);
create index if not exists call_queue_snooze_idx on trades_outreach.call_queue(snoozed_until);

alter table trades_outreach.call_queue enable row level security;
