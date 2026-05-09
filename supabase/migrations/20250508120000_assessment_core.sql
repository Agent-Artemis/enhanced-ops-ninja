-- Enhanced Ops Ninja — assessment persistence
-- RLS: enabled with no policies for anon/authenticated roles = deny direct client access.
-- Next.js route handlers should use the Supabase service role key (server-only) until Auth is wired.

create extension if not exists "pgcrypto";

create table public.assessment_sessions (
  id uuid primary key default gen_random_uuid(),
  track text not null check (track in ('healthcare', 'business')),
  tier text not null check (tier in ('free', 'paid')),
  status text not null default 'in_progress'
    check (status in ('in_progress', 'awaiting_contact', 'completed', 'abandoned')),
  client_token text not null unique,
  name text,
  email text,
  contact_captured_at timestamptz,
  stripe_checkout_session_id text,
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'pending', 'paid', 'failed', 'refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  abandoned_at timestamptz
);

create index assessment_sessions_client_token_idx on public.assessment_sessions (client_token);
create index assessment_sessions_email_idx on public.assessment_sessions (email)
  where email is not null;
create index assessment_sessions_stripe_checkout_session_id_idx
  on public.assessment_sessions (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create table public.assessment_responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.assessment_sessions (id) on delete cascade,
  question_id text not null,
  choice_key text not null check (choice_key in ('A', 'B', 'C', 'D')),
  points smallint not null check (points in (1, 3, 4, 5)),
  created_at timestamptz not null default now(),
  unique (session_id, question_id)
);

create index assessment_responses_session_id_idx on public.assessment_responses (session_id);

create table public.assessment_scores (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.assessment_sessions (id) on delete cascade,
  domain_scores jsonb not null default '{}'::jsonb,
  overall_score smallint not null check (overall_score >= 0 and overall_score <= 100),
  scoring_version text not null default 'v1',
  computed_at timestamptz not null default now(),
  unique (session_id)
);

create index assessment_scores_session_id_idx on public.assessment_scores (session_id);

create table public.assessment_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.assessment_sessions (id) on delete cascade,
  storage_path text,
  pdf_generated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (session_id)
);

create index assessment_reports_session_id_idx on public.assessment_reports (session_id);

create or replace function public.set_assessment_sessions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger assessment_sessions_set_updated_at
before update on public.assessment_sessions
for each row
execute procedure public.set_assessment_sessions_updated_at();

alter table public.assessment_sessions enable row level security;
alter table public.assessment_responses enable row level security;
alter table public.assessment_scores enable row level security;
alter table public.assessment_reports enable row level security;

comment on table public.assessment_sessions is
  'Anonymous assessment session until contact captured; tie-in via client_token (server-issued).';
comment on table public.assessment_responses is
  'One row per question per session; choice_key maps to points (A=5,B=4,C=3,D=1).';
comment on table public.assessment_scores is
  'Computed rollup after scoring; domain_scores is JSON map of domainId -> 0..100.';
comment on table public.assessment_reports is
  'Generated PDF metadata; file bytes live in Supabase Storage (path in storage_path).';
