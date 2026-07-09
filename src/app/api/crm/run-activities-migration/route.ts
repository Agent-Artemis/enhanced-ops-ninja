/**
 * One-shot migration: creates crm_activities (outreach + meeting tracking) in the
 * shared Supabase project. Connects with the runtime POSTGRES_URL (sensitive vars
 * are injected at runtime, so this can only run deployed — not locally).
 *
 * Fixed SQL, idempotent, secret-guarded. GET with header x-leads-secret to run.
 * Depends on crm_allowed() (created by the CRM migration).
 */
import { NextResponse } from "next/server";
import { Client } from "pg";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SQL = `
create table if not exists crm_activities (
  id           uuid primary key default gen_random_uuid(),
  contact_id   uuid references crm_contacts(id) on delete set null,
  kind         text not null check (kind in ('outreach','meeting')),
  platform     text not null default 'other'
                 check (platform in ('linkedin','facebook','instagram','x','phone','text','email','referral','in_person','other')),
  direction    text not null default 'outbound' check (direction in ('outbound','inbound')),
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

do $$ begin
  if not exists (select 1 from pg_policies where tablename='crm_activities' and policyname='activities_select') then
    create policy "activities_select" on crm_activities for select using (crm_allowed());
  end if;
  if not exists (select 1 from pg_policies where tablename='crm_activities' and policyname='activities_insert') then
    create policy "activities_insert" on crm_activities for insert with check (crm_allowed());
  end if;
  if not exists (select 1 from pg_policies where tablename='crm_activities' and policyname='activities_update') then
    create policy "activities_update" on crm_activities for update using (crm_allowed());
  end if;
  if not exists (select 1 from pg_policies where tablename='crm_activities' and policyname='activities_delete') then
    create policy "activities_delete" on crm_activities for delete using (crm_allowed());
  end if;
end $$;
`;

export async function GET(req: Request) {
  const secret = process.env.LEADS_API_SECRET;
  if (!secret || req.headers.get("x-leads-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
  if (!raw) return NextResponse.json({ error: "No POSTGRES_URL at runtime" }, { status: 500 });

  // Supabase presents a cert chain Node doesn't trust by default; for this
  // short-lived one-shot migration we accept it. Strip any sslmode from the URL
  // so our ssl config (below) is the single source of truth.
  const conn = raw.replace(/([?&])sslmode=[^&]*/i, "$1").replace(/[?&]$/, "");
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    await client.query(SQL);
    const { rows } = await client.query(
      "select count(*)::int as policies from pg_policies where tablename='crm_activities'",
    );
    const { rows: exists } = await client.query(
      "select to_regclass('public.crm_activities') is not null as table_exists",
    );
    return NextResponse.json({ ok: true, table_exists: exists[0]?.table_exists, policies: rows[0]?.policies ?? 0 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  } finally {
    await client.end().catch(() => {});
  }
}
