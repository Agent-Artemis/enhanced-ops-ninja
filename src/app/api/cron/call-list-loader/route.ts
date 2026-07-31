/**
 * Vercel Cron — AI CALL LIST DAILY LOADER
 * ----------------------------------------
 * Keeps the CRM "Call Lists" AI queue fed so it never goes stale. Runs daily.
 *
 * SOURCE
 *   trades_outreach.leads — but ONLY rows flagged `ai_callable = true` (business
 *   LANDLINES that a separate tagging job has verified are safe for the outbound
 *   AI agent to dial). Mobiles are never loaded. If the tagging job hasn't run yet
 *   (the `ai_callable` column may not even exist), this loader loads nothing and
 *   catches up on a later run — it never guesses.
 *
 * WHAT IT DOES each run:
 *   1. Auto re-queues snoozed leads whose `snoozed_until` has passed (a "no" from
 *      months ago comes back around).
 *   2. Tops the active queue up to CALL_LIST_DAILY_TARGET (default 15) fresh
 *      'queued' leads by promoting new ai_callable leads into
 *      trades_outreach.call_queue. Deduped on lead_id.
 *
 * It SENDS NOTHING and DIALS NOTHING — it only stages prospects. Dialing (Jason /
 * Retell) is a separate, gated action from the Call Lists tab.
 *
 * NOT in OCS: these never touch crm_contacts or the OCS "Action Needed" list.
 */
import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_TARGET = 15;

function dailyTarget(): number {
  const raw =
    process.env.CALL_LIST_DAILY_TARGET ?? process.env.SOCIAL_LOADER_DAILY_TARGET ?? "";
  return Math.max(0, parseInt(raw, 10) || DEFAULT_TARGET);
}

/** True when a Postgres error means the ai_callable column doesn't exist yet. */
function isMissingAiCallable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === "42703") return true; // undefined_column
  return /ai_callable/i.test(err.message ?? "");
}

interface TradeLead {
  id: number;
  business_name: string | null;
  phone_e164: string | null;
  phone: string | null;
  category: string | null;
  city: string | null;
  county: string | null;
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const trades = admin.schema("trades_outreach");
  const target = dailyTarget();
  const nowIso = new Date().toISOString();

  // ── 1. Auto re-queue expired snoozes ────────────────────────────────────────
  const { data: reactivated, error: reErr } = await trades
    .from("call_queue")
    .update({ status: "queued", queued_at: nowIso, snoozed_until: null, updated_at: nowIso })
    .eq("status", "snoozed")
    .lte("snoozed_until", nowIso)
    .select("id");
  if (reErr) {
    return NextResponse.json({ error: `reactivate: ${reErr.message}` }, { status: 500 });
  }
  const reactivatedCount = reactivated?.length ?? 0;

  // ── 2. How many fresh 'queued' leads are already available? ─────────────────
  const { count: queuedCount, error: cntErr } = await trades
    .from("call_queue")
    .select("*", { count: "exact", head: true })
    .eq("status", "queued");
  if (cntErr) {
    return NextResponse.json({ error: `count: ${cntErr.message}` }, { status: 500 });
  }

  const need = Math.max(0, target - (queuedCount ?? 0));
  if (need === 0) {
    return NextResponse.json({
      ok: true,
      target,
      reactivated: reactivatedCount,
      queued_now: queuedCount ?? 0,
      added: 0,
      note: "Queue already at target.",
    });
  }

  // ── 3. Which leads are already in the queue (any status)? — dedupe set ──────
  const { data: existing, error: exErr } = await trades
    .from("call_queue")
    .select("lead_id")
    .limit(10000);
  if (exErr) {
    return NextResponse.json({ error: `existing: ${exErr.message}` }, { status: 500 });
  }
  const alreadyQueued = new Set<number>((existing ?? []).map((r) => r.lead_id as number));

  // ── 4. Pull fresh AI-callable LANDLINE candidates ───────────────────────────
  let query = trades
    .from("leads")
    .select("id, business_name, phone_e164, phone, category, city, county")
    .eq("ai_callable", true) // LANDLINES ONLY — never mobiles
    .eq("callable", true)
    .is("exclude_reason", null)
    .neq("dnc_status", "dnc")
    .order("id", { ascending: true })
    .limit(need + alreadyQueued.size + 200);

  if (alreadyQueued.size > 0) {
    query = query.not("id", "in", `(${[...alreadyQueued].join(",")})`);
  }

  const { data: candidates, error: candErr } = await query;

  if (candErr) {
    // Tagging job hasn't added ai_callable yet → load nothing, catch up next run.
    if (isMissingAiCallable(candErr)) {
      return NextResponse.json({
        ok: true,
        target,
        reactivated: reactivatedCount,
        queued_now: queuedCount ?? 0,
        added: 0,
        note: "ai_callable not present yet — waiting on the landline-tagging job. No leads loaded.",
      });
    }
    return NextResponse.json({ error: `candidates: ${candErr.message}` }, { status: 500 });
  }

  const rows = ((candidates ?? []) as TradeLead[]).slice(0, need).map((lead) => ({
    lead_id: lead.id,
    business_name: (lead.business_name ?? "").trim() || "Unknown business",
    phone_e164: lead.phone_e164 || lead.phone || null,
    category: lead.category ?? null,
    city: lead.city ?? null,
    county: lead.county ?? null,
    status: "queued",
    queued_at: nowIso,
  }));

  if (rows.length === 0) {
    return NextResponse.json({
      ok: true,
      target,
      reactivated: reactivatedCount,
      queued_now: queuedCount ?? 0,
      added: 0,
      note: "No fresh ai_callable landline leads available to promote.",
    });
  }

  const { error: insErr, count: insCount } = await trades
    .from("call_queue")
    .insert(rows, { count: "exact" });
  if (insErr) {
    return NextResponse.json({ error: `insert: ${insErr.message}` }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    target,
    reactivated: reactivatedCount,
    queued_before: queuedCount ?? 0,
    added: insCount ?? rows.length,
    queued_now: (queuedCount ?? 0) + (insCount ?? rows.length),
  });
}
