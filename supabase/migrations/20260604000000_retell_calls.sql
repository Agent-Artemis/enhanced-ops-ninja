-- Retell IVR call log table
-- Stores inbound webhook events from Retell AI for each completed call.
-- Upsert on call_id ensures replayed webhooks don't create duplicates.

create table if not exists public.retell_calls (
  id uuid primary key default gen_random_uuid(),
  call_id text unique not null,
  agent_id text,
  from_number text,
  to_number text,
  call_status text,
  call_reason text,
  patient_name text,
  call_disposition text,
  follow_up_required boolean default false,
  follow_up_notes text,
  duration_ms integer,
  recording_url text,
  transcript text,
  raw_payload jsonb,
  created_at timestamptz default now()
);

-- Indexes for common query patterns
create index if not exists retell_calls_created_at_idx on public.retell_calls (created_at desc);
create index if not exists retell_calls_agent_id_idx on public.retell_calls (agent_id);
create index if not exists retell_calls_call_status_idx on public.retell_calls (call_status);

-- RLS: enabled; no policies = deny direct client access.
-- API routes use the service role key (server-only).
alter table public.retell_calls enable row level security;
