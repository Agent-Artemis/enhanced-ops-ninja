/**
 * 14-day re-loop driver — SHIPPED DISABLED.
 *
 * Spec: run msg1 → msg2 → msg3. If a lead does not reply within 14 days of
 * msg3_sent_at, it re-enters a NEW 3-message sequence. Loops until the lead
 * replies or is removed.
 *
 * This endpoint ONLY changes state and queues work. It NEVER auto-sends anything
 * and NEVER auto-generates copy. Leads entering a new round are flagged
 * needs_copy=true with empty msg fields so a human/agent writes fresh copy
 * (round-1 text is never reused).
 *
 * GATE: the entire loop is inert unless env LINKEDIN_LOOP_ENABLED is 'true'/'1'.
 * With the flag unset this route touches no data and returns { enabled: false }.
 * Reply detection must be proven in production before this is turned on.
 *
 * POST /api/linkedin/run-loop
 * Header: x-leads-secret must match LEADS_API_SECRET.
 *
 * Each run advances one hop per lead (idempotent):
 *   1. cooling                        → new round: sequence_step='msg1',
 *      sequence_round+1, needs_copy=true, msg copy cleared, sequence_due cleared
 *   2. done + ≥14d since msg3_sent_at + not replied → sequence_step='cooling'
 */
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

function loopEnabled(): boolean {
  const v = process.env.LINKEDIN_LOOP_ENABLED;
  return v === "true" || v === "1";
}

interface ContactRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  custom_fields: Record<string, unknown> | null;
}

export async function POST(req: Request) {
  const secret = process.env.LEADS_API_SECRET;
  if (!secret || req.headers.get("x-leads-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // GATE — inert when the flag is unset/off. No DB access, no mutations.
  if (!loopEnabled()) {
    return NextResponse.json({
      enabled: false,
      message: "LINKEDIN_LOOP_ENABLED is not set — loop is inert.",
      scanned: 0,
      cooled: 0,
      restarted: 0,
    });
  }

  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from("crm_contacts")
    .select("id, first_name, last_name, custom_fields")
    .not("custom_fields->linkedin", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as ContactRow[];
  const now = Date.now();

  let scanned = 0;
  let cooled = 0;
  let restarted = 0;
  const errors: string[] = [];
  const cooledNames: string[] = [];
  const restartedNames: string[] = [];

  for (const contact of rows) {
    const cf = { ...(contact.custom_fields ?? {}) };
    const li = { ...(cf.linkedin as Record<string, unknown> ?? {}) };
    scanned++;

    const step = li.sequence_step as string | undefined;
    const replied = li.replied === true;
    if (replied) continue; // replied leads are terminal — never re-looped

    const name = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim();

    // Hop 1: cooling → new round (fresh copy required).
    if (step === "cooling") {
      const round = typeof li.sequence_round === "number" ? li.sequence_round : 1;
      li.sequence_round = round + 1;
      li.sequence_step = "msg1";
      li.needs_copy = true;
      li.status = "new";
      // Fresh copy per round is REQUIRED — clear round-N text so it is never reused.
      li.msg1 = "";
      li.msg2 = "";
      li.msg3 = "";
      delete li.msg2_asset;
      delete li.msg3_asset;
      delete li.accepted_msg;
      li.sequence_due = null; // surfaces in "Needs copy", not the send queue
      cf.linkedin = li;

      const { error: updErr } = await admin
        .from("crm_contacts").update({ custom_fields: cf }).eq("id", contact.id);
      if (updErr) errors.push(`${name} (${contact.id}): ${updErr.message}`);
      else { restarted++; restartedNames.push(name); }
      continue;
    }

    // Hop 2: done + ≥14 days since msg3_sent_at + not replied → cooling.
    if (step === "done") {
      const m3 = li.msg3_sent_at as string | undefined;
      if (!m3) continue; // no msg3 timestamp → cannot measure the 14-day window
      const sentMs = new Date(m3).getTime();
      if (Number.isNaN(sentMs)) continue;
      if (now - sentMs < FOURTEEN_DAYS_MS) continue;

      li.sequence_step = "cooling";
      cf.linkedin = li;

      const { error: updErr } = await admin
        .from("crm_contacts").update({ custom_fields: cf }).eq("id", contact.id);
      if (updErr) errors.push(`${name} (${contact.id}): ${updErr.message}`);
      else { cooled++; cooledNames.push(name); }
    }
  }

  return NextResponse.json({
    enabled: true,
    scanned,
    cooled,
    restarted,
    cooled_names: cooledNames,
    restarted_names: restartedNames,
    ...(errors.length ? { errors } : {}),
  });
}
