-- Nurture queue: one row per scheduled email per lead.
-- The cron job at /api/cron/nurture picks up rows where
-- scheduled_at <= now() and status = 'pending' and sends them.

create table if not exists nurture_queue (
  id              uuid primary key default gen_random_uuid(),
  email           text not null,
  first_name      text not null default '',
  session_id      uuid references assessment_sessions(id) on delete set null,
  sequence        text not null,       -- 'free_assessment'
  step            int  not null,       -- 0 = results, 1 = day2, 2 = day5, 3 = day10
  scheduled_at    timestamptz not null,
  sent_at         timestamptz,
  status          text not null default 'pending' check (status in ('pending','sent','cancelled')),
  created_at      timestamptz not null default now()
);

create index if not exists nurture_queue_pending_idx
  on nurture_queue (scheduled_at)
  where status = 'pending';

create unique index if not exists nurture_queue_dedup_idx
  on nurture_queue (email, sequence, step);
