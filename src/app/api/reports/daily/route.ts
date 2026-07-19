/**
 * Ingest a daily markdown report.
 *
 * POST { date?, slug?, title, markdown }
 * Header: x-leads-secret must match LEADS_API_SECRET.
 *
 * An automated morning job posts concise markdown reports here (e.g. the LinkedIn
 * accept-catcher). Reports are upserted on (report_date, slug) so re-running the
 * job for the same day overwrites the previous report instead of duplicating it.
 * Jeff reviews them in the CRM Reports tab. Uses the service role (getSupabaseAdmin),
 * which bypasses the deny-all RLS on daily_reports.
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Business timezone. `date` defaults to today's calendar day in Denver, not UTC. */
const BUSINESS_TZ = "America/Denver";

/** Today's calendar date in America/Denver as a "YYYY-MM-DD" string. */
function denverToday(): string {
  // en-CA formats as YYYY-MM-DD; timeZone pins it to the Denver calendar day.
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ }).format(new Date());
}

const bodySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "`date` must be a YYYY-MM-DD string")
    .optional(),
  slug: z.string().min(1, "`slug` must be a non-empty string").optional(),
  title: z.string().min(1, "`title` is required"),
  markdown: z.string().min(1, "`markdown` is required"),
});

export async function POST(req: Request) {
  const secret = process.env.LEADS_API_SECRET;
  if (!secret || req.headers.get("x-leads-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json: unknown = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          "Invalid body — expected { date?, slug?, title, markdown } with a non-empty title and markdown",
        details: parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`),
      },
      { status: 400 },
    );
  }

  const reportDate = parsed.data.date ?? denverToday();
  const slug = parsed.data.slug ?? "linkedin-accept-catcher";
  const nowIso = new Date().toISOString();

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("daily_reports")
    .upsert(
      {
        report_date: reportDate,
        slug,
        title: parsed.data.title,
        body_markdown: parsed.data.markdown,
        updated_at: nowIso,
      },
      { onConflict: "report_date,slug" },
    )
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
