/**
 * AI Call Queue API — powers the live "AI Call List (Jason)" section on the CRM
 * Call Lists tab. Reads/writes trades_outreach.call_queue via the service-role
 * admin client (the table is RLS-locked, so the browser client can't touch it).
 *
 * GET  → { queued: [...], counts: { queued, snoozed, booked, called } }
 *          active call list (status='queued'), newest first, limit 200.
 *
 * POST { id, action, ... } → lifecycle transitions:
 *   - 'dial'   : place an outbound call with Jason (Retell). GATED — does nothing
 *                unless JASON_DIALING_ENABLED === 'true'. Off by default this pass.
 *   - 'called' : record a dial attempt (status→'called', last_call_at=now).
 *   - 'no'     : prospect said no → snooze CALL_LIST_SNOOZE_MONTHS out (default 4),
 *                removed from the active list; the loader auto re-queues it later.
 *   - 'booked' : Jason booked them → removed from the list. They flow into OCS via
 *                the existing Cal.com webhook; we never duplicate them here.
 *   - 'remove' : drop (bad number / not a fit).
 *
 * Headers: Authorization: Bearer <supabase-jwt> (an @enhancedops.ninja / Jeff user).
 */
import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { retellCreatePhoneCall } from "@/lib/voice/retell";

export const dynamic = "force-dynamic";

const SNOOZE_MONTHS_DEFAULT = 4; // within the 3–6 month window

function isAllowed(email: string) {
  return email.endsWith("@enhancedops.ninja") || email === "jeff@augeo-hq.com";
}

async function authUser(req: Request) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const admin = getSupabaseAdmin();
  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(token);
  if (authError || !user?.email || !isAllowed(user.email)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { admin };
}

export async function GET(req: Request) {
  const { admin, error } = await authUser(req);
  if (error) return error;
  const trades = admin!.schema("trades_outreach");

  const { data: queued, error: qErr } = await trades
    .from("call_queue")
    .select("id, lead_id, business_name, phone_e164, category, city, county, status, queued_at, last_call_at, last_outcome")
    .eq("status", "queued")
    .order("queued_at", { ascending: true })
    .limit(200);
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });

  const counts: Record<string, number> = {};
  for (const s of ["queued", "snoozed", "booked", "called"]) {
    const { count } = await trades
      .from("call_queue")
      .select("*", { count: "exact", head: true })
      .eq("status", s);
    counts[s] = count ?? 0;
  }

  return NextResponse.json({
    queued: queued ?? [],
    counts,
    dialing_enabled: process.env.JASON_DIALING_ENABLED === "true",
  });
}

export async function POST(req: Request) {
  const { admin, error } = await authUser(req);
  if (error) return error;
  const trades = admin!.schema("trades_outreach");

  const body = (await req.json().catch(() => null)) as
    | { id?: number; action?: string; outcome?: string; crm_contact_id?: string }
    | null;
  const id = body?.id;
  const action = body?.action;
  if (typeof id !== "number" || !action) {
    return NextResponse.json({ error: "Expected { id:number, action:string }" }, { status: 400 });
  }

  const nowIso = new Date().toISOString();

  // ── Gated dial (Jason / Retell) ─────────────────────────────────────────────
  if (action === "dial") {
    const enabled = process.env.JASON_DIALING_ENABLED === "true";
    if (!enabled) {
      // GATE: integration point exists but is intentionally off until Jeff enables it.
      return NextResponse.json({
        ok: false,
        gated: true,
        message:
          "Jason dialing is gated OFF. Set JASON_DIALING_ENABLED=true (and RETELL_FROM_NUMBER / JASON_AGENT_ID) to enable outbound calls.",
      });
    }

    const fromNumber = process.env.RETELL_FROM_NUMBER;
    const agentId = process.env.JASON_AGENT_ID;
    if (!fromNumber) {
      return NextResponse.json({ error: "RETELL_FROM_NUMBER not configured" }, { status: 503 });
    }

    const { data: lead, error: lErr } = await trades
      .from("call_queue")
      .select("id, phone_e164, business_name")
      .eq("id", id)
      .maybeSingle();
    if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });
    if (!lead?.phone_e164) {
      return NextResponse.json({ error: "No phone number on this lead" }, { status: 400 });
    }

    let callId: string | undefined;
    try {
      const call = await retellCreatePhoneCall({
        toNumber: lead.phone_e164,
        fromNumber,
        agentId,
        metadata: { call_queue_id: id, business_name: lead.business_name },
      });
      callId = call.call_id;
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "dial failed" },
        { status: 502 },
      );
    }

    await trades
      .from("call_queue")
      .update({ status: "called", last_call_at: nowIso, retell_call_id: callId ?? null, updated_at: nowIso })
      .eq("id", id);
    return NextResponse.json({ ok: true, dialed: true, retell_call_id: callId ?? null });
  }

  // ── Non-dial lifecycle transitions ──────────────────────────────────────────
  let patch: Record<string, unknown> = { updated_at: nowIso };

  if (action === "called") {
    patch = { ...patch, status: "called", last_call_at: nowIso, last_outcome: body?.outcome ?? "called" };
  } else if (action === "no") {
    const months = Math.max(
      1,
      parseInt(process.env.CALL_LIST_SNOOZE_MONTHS ?? "", 10) || SNOOZE_MONTHS_DEFAULT,
    );
    const until = new Date();
    until.setMonth(until.getMonth() + months);
    patch = {
      ...patch,
      status: "snoozed",
      snoozed_until: until.toISOString(),
      last_outcome: "no",
      last_call_at: nowIso,
    };
  } else if (action === "booked") {
    // Removed from the call list; flows into OCS via the existing Cal.com webhook.
    patch = {
      ...patch,
      status: "booked",
      booked_at: nowIso,
      last_outcome: "booked",
      crm_contact_id: body?.crm_contact_id ?? null,
    };
  } else if (action === "remove") {
    patch = { ...patch, status: "removed" };
  } else {
    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }

  const { error: uErr } = await trades.from("call_queue").update(patch).eq("id", id);
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, status: patch.status });
}
