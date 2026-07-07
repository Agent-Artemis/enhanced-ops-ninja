/**
 * One-time migration: creates compliance_items and compliance_training tables
 * in the shared Supabase project (used by the Ninja Dojo compliance tab).
 * GET with header x-leads-secret to run.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

async function runSQL(sql: string): Promise<string> {
  const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ query: sql }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    return `error: ${res.status} ${body}`;
  }
  return "ok";
}

export async function GET(req: Request) {
  const secret = process.env.LEADS_API_SECRET;
  if (!secret || req.headers.get("x-leads-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, string> = {};

  // compliance_items — Phase 1 / Phase 2 checklist persistence
  results.compliance_items = await runSQL(`
    CREATE TABLE IF NOT EXISTS compliance_items (
      item_key TEXT PRIMARY KEY,
      phase INTEGER NOT NULL,
      completed BOOLEAN DEFAULT FALSE NOT NULL,
      completed_at TIMESTAMPTZ,
      completed_by TEXT,
      notes TEXT DEFAULT '' NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );
    ALTER TABLE compliance_items ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename='compliance_items' AND policyname='compliance_auth'
      ) THEN
        CREATE POLICY "compliance_auth" ON compliance_items
          FOR ALL TO authenticated USING (true) WITH CHECK (true);
      END IF;
    END $$;
  `);

  // compliance_training — Workforce training log
  results.compliance_training = await runSQL(`
    CREATE TABLE IF NOT EXISTS compliance_training (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      training_date DATE NOT NULL,
      module TEXT NOT NULL,
      attested BOOLEAN DEFAULT TRUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );
    ALTER TABLE compliance_training ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename='compliance_training' AND policyname='training_auth'
      ) THEN
        CREATE POLICY "training_auth" ON compliance_training
          FOR ALL TO authenticated USING (true) WITH CHECK (true);
      END IF;
    END $$;
  `);

  const allOk = Object.values(results).every((v) => v === "ok");
  return NextResponse.json({ ok: allOk, tables: results });
}
