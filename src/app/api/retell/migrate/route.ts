/**
 * ONE-TIME MIGRATION ENDPOINT — DELETE THIS FILE AFTER USE.
 *
 * Creates the retell_calls table in Supabase via direct Postgres connection.
 * Protected by a bearer token: RETELL_MIGRATE_SECRET.
 *
 * Usage:
 *   curl -X POST https://<domain>/api/retell/migrate \
 *     -H "Authorization: Bearer <RETELL_MIGRATE_SECRET>"
 */
import { NextResponse } from "next/server";
import { Pool } from "pg";

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

  const connectionString = process.env.POSTGRES_URL_NON_POOLING;
  if (!connectionString) {
    return NextResponse.json({ error: "POSTGRES_URL_NON_POOLING not configured" }, { status: 503 });
  }

  // Supabase requires SSL; rejectUnauthorized=false handles self-signed certs in their chain.
  const pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
    max: 1,
    connectionTimeoutMillis: 10000,
  });

  try {
    const client = await pool.connect();
    try {
      // Run each statement separately to avoid multi-statement issues
      await client.query(`
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
        )
      `);
      await client.query(`create index if not exists retell_calls_created_at_idx on public.retell_calls (created_at desc)`);
      await client.query(`create index if not exists retell_calls_agent_id_idx on public.retell_calls (agent_id)`);
      await client.query(`create index if not exists retell_calls_call_status_idx on public.retell_calls (call_status)`);
      await client.query(`alter table public.retell_calls enable row level security`);
      
      // Verify table exists
      const check = await client.query(`SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'retell_calls'`);
      const tableExists = parseInt(check.rows[0].count, 10) > 0;
      
      return NextResponse.json({ 
        ok: true, 
        message: "retell_calls table created (or already exists)",
        tableExists,
      });
    } finally {
      client.release();
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await pool.end().catch(() => null);
  }
}
