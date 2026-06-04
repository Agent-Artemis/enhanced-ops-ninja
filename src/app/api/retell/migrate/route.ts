/**
 * ONE-TIME MIGRATION ENDPOINT — DELETE THIS FILE AFTER USE.
 *
 * Creates the retell_calls table in Supabase.
 * Protected by a bearer token: RETELL_MIGRATE_SECRET.
 *
 * Usage:
 *   curl -X POST https://<domain>/api/retell/migrate \
 *     -H "Authorization: Bearer <RETELL_MIGRATE_SECRET>"
 */
import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const MIGRATION_SQL = `
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

create index if not exists retell_calls_created_at_idx on public.retell_calls (created_at desc);
create index if not exists retell_calls_agent_id_idx on public.retell_calls (agent_id);
create index if not exists retell_calls_call_status_idx on public.retell_calls (call_status);

alter table public.retell_calls enable row level security;
`;

export async function POST(req: Request) {
  const secret = process.env.RETELL_MIGRATE_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "RETELL_MIGRATE_SECRET not set" }, { status: 503 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = getSupabaseAdmin();
    // Use the rpc exec approach — first create the exec_sql helper via a raw approach.
    // Supabase supports running arbitrary SQL via the pg query endpoint when using
    // the service role and the right path. We'll use the rpc approach.
    const { error } = await admin.rpc("exec_sql", { sql: MIGRATION_SQL }).maybeSingle();

    if (error && error.message.includes("exec_sql")) {
      // exec_sql function doesn't exist — need to create it first.
      // The service role can create functions via the REST API directly.
      // We bootstrap by calling the pg query endpoint.
      const pgResp = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sql: MIGRATION_SQL }),
        },
      );

      if (!pgResp.ok) {
        const body = await pgResp.text();
        return NextResponse.json(
          { error: "Migration failed — exec_sql not available", details: body },
          { status: 500 },
        );
      }
    } else if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: "retell_calls table created (or already exists)" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
