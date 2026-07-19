/**
 * LinkedIn accept-catcher — deterministic daily report generator.
 *
 * This endpoint no longer depends on the flaky cloud AI routine to post a
 * report. Every morning (Vercel Cron, 8:30am America/Denver) it builds the real
 * daily LinkedIn accept-catcher report straight from the CRM database and
 * upserts it into `daily_reports` under slug `linkedin-accept-catcher`. The DB
 * is the source of truth: the report is regenerated from `crm_contacts` each
 * run, so re-running simply overwrites today's entry with the current picture.
 *
 * "Accepted today" = a linkedin-lead contact whose custom_fields.linkedin.accepted
 * is true AND whose custom_fields.linkedin.accepted_at, when formatted in
 * America/Denver, falls on today's Denver date. Those are split into organic
 * (Jeff's manual invites, origin === 'organic') and existing sequence leads.
 *
 * Auth: protected by CRON_SECRET. Vercel Cron sends
 * `Authorization: Bearer $CRON_SECRET`; manual runs may pass `?secret=$CRON_SECRET`.
 *
 * Env: CRON_SECRET, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const SLUG = "linkedin-accept-catcher";
const BUSINESS_TZ = "America/Denver";
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

interface ContactRow {
  first_name: string | null;
  last_name: string | null;
  custom_fields: Record<string, unknown> | null;
  created_at: string | null;
}

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret;
}

/** Format an ISO timestamp (or Date) as its America/Denver calendar date, YYYY-MM-DD. */
function denverDate(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  // en-CA formats as YYYY-MM-DD; timeZone pins it to the Denver calendar day.
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ }).format(d);
}

/** "Jul 19" style label derived from a YYYY-MM-DD string — no external lib. */
function monthDayLabel(ymd: string): string {
  const [, mm, dd] = ymd.split("-");
  const month = MONTHS[Number(mm) - 1] ?? mm;
  const day = Number(dd);
  return `${month} ${day}`;
}

/** The linkedin block may carry accepted as a boolean or as the string "true". */
function isAccepted(value: unknown): boolean {
  return value === true || (typeof value === "string" && value.toLowerCase() === "true");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const todayDenver = denverDate(new Date());
  const label = monthDayLabel(todayDenver);
  const title = `LinkedIn Accept-Catcher — ${label}`;

  try {
    const supabase = getSupabaseAdmin();

    // All LinkedIn leads (~110) — filter, count, and split in JS.
    const { data, error: selErr } = await supabase
      .from("crm_contacts")
      .select("first_name, last_name, custom_fields, created_at")
      .contains("tags", ["linkedin-lead"]);
    if (selErr) throw new Error(`select: ${selErr.message}`);

    const rows = (data ?? []) as ContactRow[];

    let total = 0; // all linkedin-leads with accepted === true
    const organic: string[] = [];
    const existing: string[] = [];

    for (const row of rows) {
      const li = row.custom_fields?.linkedin;
      if (!isObject(li)) continue;
      if (!isAccepted(li.accepted)) continue;

      total += 1;

      const acceptedAt = li.accepted_at;
      if (typeof acceptedAt !== "string" || !acceptedAt) continue;
      if (denverDate(acceptedAt) !== todayDenver) continue;

      const name = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim();
      if (li.origin === "organic") organic.push(name);
      else existing.push(name);
    }

    const newToday = organic.length + existing.length;

    // Build the markdown report — always produced, even when zero.
    let body_markdown: string;
    if (newToday === 0) {
      body_markdown =
        `## ${title}\n` +
        "✅ **Ran. No new accepted connections today** — nothing pending, nothing fell through.\n\n" +
        `_Generated from the CRM. ${total} accepted connections are in the Social list to schedule an appointment message._`;
    } else {
      const lines: string[] = [
        `## ${title}`,
        `✅ **Ran. ${newToday} new accepted connection(s) today** — all added to the Social list to schedule an appointment message.`,
      ];
      if (organic.length > 0) {
        lines.push("");
        lines.push(`### New organic connections (${organic.length})`);
        for (const name of organic) lines.push(`- ${name}`);
      }
      if (existing.length > 0) {
        lines.push("");
        lines.push(`### Existing leads marked accepted (${existing.length})`);
        for (const name of existing) lines.push(`- ${name}`);
      }
      body_markdown = lines.join("\n");
    }

    // Upsert on (report_date, slug) — overwrites any earlier entry for today.
    const { error: upErr } = await supabase.from("daily_reports").upsert(
      {
        report_date: todayDenver,
        slug: SLUG,
        title,
        body_markdown,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "report_date,slug" },
    );
    if (upErr) throw new Error(`upsert: ${upErr.message}`);

    return NextResponse.json({ ok: true, date: todayDenver, newToday, total });
  } catch (e) {
    return NextResponse.json(
      { error: String(e instanceof Error ? e.message : e) },
      { status: 500 },
    );
  }
}
