-- In-depth ops assessment (build-package Section 4) — NEW tables prefixed with ops_
-- to avoid colliding with existing assessment_sessions / assessment_responses / etc.
-- Server routes use Supabase service role; RLS is enabled with no policies = deny-all for anon/auth.

create extension if not exists "pgcrypto";

create table public.ops_assessment_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_name text not null,
  client_email text not null,
  organization_name text,
  annual_revenue numeric,
  team_size integer,
  track text not null check (track in ('healthcare', 'general_business')),
  assessment_type text not null default 'in_depth',
  stripe_payment_id text unique,
  stripe_status text not null default 'pending',
  status text not null default 'not_started',
  started_at timestamptz,
  completed_at timestamptz,
  current_module integer not null default 1,
  current_question integer not null default 1,
  cal_booking_id text,
  call_scheduled_at timestamptz,
  report_generated boolean not null default false,
  report_url text,
  report_generated_at timestamptz
);

create index ops_assessment_sessions_client_email_idx
  on public.ops_assessment_sessions (client_email);
create index ops_assessment_sessions_status_idx
  on public.ops_assessment_sessions (status);
create index ops_assessment_sessions_created_at_idx
  on public.ops_assessment_sessions (created_at desc);

create table public.ops_assessment_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ops_assessment_sessions (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  module_number integer not null,
  module_name text not null,
  question_number integer not null,
  question_key text not null,
  question_text text,
  answer_choice text check (answer_choice in ('A', 'B', 'C', 'D')),
  answer_points integer check (answer_points in (1, 2, 3, 4)),
  unique (session_id, question_key)
);

create index ops_assessment_answers_session_id_idx
  on public.ops_assessment_answers (session_id);

create table public.ops_module_scores (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ops_assessment_sessions (id) on delete cascade,
  calculated_at timestamptz not null default now(),
  module_number integer not null,
  module_name text not null,
  questions_answered integer,
  raw_points_earned integer,
  max_possible_points integer,
  module_score_pct numeric(5, 2),
  module_weight numeric(4, 3),
  weighted_score numeric(5, 2),
  status_color text check (status_color in ('RED', 'YELLOW', 'GREEN')),
  dollar_loss_calculated numeric,
  dollar_loss_label text,
  recommended_offer text,
  recommended_offer_desc text,
  deployment_timeline text,
  expected_impact text,
  unique (session_id, module_number)
);

create index ops_module_scores_session_id_idx on public.ops_module_scores (session_id);

create table public.ops_assessment_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ops_assessment_sessions (id) on delete cascade unique,
  generated_at timestamptz not null default now(),
  overall_score numeric(5, 2),
  overall_status text check (overall_status in ('RED', 'YELLOW', 'GREEN')),
  total_dollar_loss numeric,
  total_dollar_loss_label text,
  priority_1_module text,
  priority_1_finding text,
  priority_2_module text,
  priority_2_finding text,
  priority_3_module text,
  priority_3_finding text,
  phase_1_recommendations jsonb,
  phase_2_recommendations jsonb,
  phase_3_recommendations jsonb,
  full_report_json jsonb,
  pdf_url text,
  pdf_generated boolean not null default false
);

create index ops_assessment_reports_session_id_idx on public.ops_assessment_reports (session_id);

create or replace function public.set_ops_assessment_answers_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger ops_assessment_answers_set_updated_at
before update on public.ops_assessment_answers
for each row
execute procedure public.set_ops_assessment_answers_updated_at();

alter table public.ops_assessment_sessions enable row level security;
alter table public.ops_assessment_answers enable row level security;
alter table public.ops_module_scores enable row level security;
alter table public.ops_assessment_reports enable row level security;

comment on table public.ops_assessment_sessions is
  'Paid in-depth ops assessment sessions (build-package). Accessed via service role from Next.js API routes.';
comment on table public.ops_assessment_answers is
  'Per-question answers for ops in-depth flow; RLS deny-all — server writes with service role.';
comment on table public.ops_module_scores is
  'Computed module rollups after assessment completion.';
comment on table public.ops_assessment_reports is
  'Summary row + JSON snapshot for PDF; pdf_url when stored in Supabase Storage bucket assessment-reports.';
