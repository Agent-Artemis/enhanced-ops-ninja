/**
 * LinkedIn accept-catcher heartbeat backstop.
 *
 * A cloud AI routine runs each morning (~7:30am America/Denver): it reads Gmail
 * for LinkedIn accepts, updates the CRM, and POSTs a markdown report to
 * `daily_reports` under slug `linkedin-accept-catcher`. That routine is an LLM
 * and sometimes forgets (or fails) to post — leaving the Daily Reports tab with
 * no entry and no confirmation for the day.
 *
 * This endpoint runs ~1 hour later (Vercel Cron, 8:30am MT). If a report for
 * today already exists it does nothing. If not, it posts a loud fallback entry
 * so the tab ALWAYS has a positive daily confirmation. It writes under the SAME
 * slug so that a real report arriving later upserts over this fallback.
 *
 * Auth: protected by CRON_SECRET (same check as ingest-granola). Vercel Cron
 * sends `Authorization: Bearer $CRON_SECRET`; manual runs may pass
 * `?secret=$CRON_SECRET`.
 *
 * Env: CRON_SECRET, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const SLUG = "linkedin-accept-catcher";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret;
}

/** Today's date in America/Denver as YYYY-MM-DD (NOT UTC — avoids rollover). */
function denverToday(): { ymd: string; label: string } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const ymd = `${get("year")}-${get("month")}-${get("day")}`;
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "2-digit",
  }).format(now); // e.g. "Jul 19"
  return { ymd, label };
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { ymd: date, label } = denverToday();

  try {
    const supabase = getSupabaseAdmin();

    // Is there already a report for today under this slug?
    const { data: existing, error: selErr } = await supabase
      .from("daily_reports")
      .select("id")
      .eq("report_date", date)
      .eq("slug", SLUG)
      .maybeSingle();
    if (selErr) throw new Error(`select: ${selErr.message}`);

    if (existing) {
      return NextResponse.json({ ok: true, status: "report-present", date });
    }

    // No report → post the loud fallback. Upsert on (report_date, slug) with
    // ignoreDuplicates so a real report posted a moment ago is never clobbered.
    const title = `⚠️ LinkedIn Accept-Catcher — ${label} (no report)`;
    const body_markdown =
      "## ⚠️ No accept-catcher report today\n\n" +
      "The morning LinkedIn accept-catcher did not post a report by the heartbeat " +
      "check (~8:30am MT). That means it either did not run, or ran but failed to " +
      "post. Nothing is confirmed for today's accepts.\n\n" +
      "**What to do:** check the routine run, or re-run it manually. If this keeps " +
      "happening, the automation needs a look.";

    const { error: upErr } = await supabase
      .from("daily_reports")
      .upsert(
        { report_date: date, slug: SLUG, title, body_markdown },
        { onConflict: "report_date,slug", ignoreDuplicates: true },
      );
    if (upErr) throw new Error(`upsert: ${upErr.message}`);

    return NextResponse.json({ ok: true, status: "fallback-posted", date });
  } catch (e) {
    return NextResponse.json(
      { error: String(e instanceof Error ? e.message : e) },
      { status: 500 },
    );
  }
}
