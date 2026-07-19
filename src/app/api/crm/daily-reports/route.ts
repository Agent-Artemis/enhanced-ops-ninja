/**
 * Daily reports feed for the CRM Reports tab.
 *
 * GET /api/crm/daily-reports
 * Headers: Authorization: Bearer <supabase-jwt>  (an @enhancedops.ninja / Jeff user)
 *
 * Returns the most recent daily markdown reports written by the automated morning
 * job (see POST /api/reports/daily). Uses the service role so it can read across the
 * deny-all RLS on daily_reports.
 */

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function isAllowed(email: string) {
  return email.endsWith("@enhancedops.ninja") || email === "jeff@augeo-hq.com";
}

export async function GET(req: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(token);
  if (authError || !user?.email || !isAllowed(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Reports (newest first) ──────────────────────────────────────────────────
  const { data, error } = await admin
    .from("daily_reports")
    .select("id, report_date, slug, title, body_markdown, created_at")
    .order("report_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(90);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ reports: data ?? [] });
}
