/**
 * CRM Reports aggregation endpoint.
 *
 * Powers the Reports tab in /crm. Uses the service role so it can read both the
 * CRM activity tables AND the Dojo revenue tables (clients/briefings/msas),
 * which are behind RLS the browser CRM client can't cross.
 *
 * GET /api/crm/reports?days=90
 * Headers: Authorization: Bearer <supabase-jwt>  (an @enhancedops.ninja / Jeff user)
 */

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function isAllowed(email: string) {
  return email.endsWith("@enhancedops.ninja") || email === "jeff@augeo-hq.com";
}

// Same probabilities the Dojo's RevenueProjections uses — keep in sync.
const STAGE_PROB: Record<string, number> = {
  free_assessment_complete: 0.05,
  paid_assessment_purchased: 0.1,
  paid_assessment_complete: 0.2,
  briefing_ready: 0.4,
  briefing_presented: 0.6,
  mission_funded: 0.9,
  mission_active: 1.0,
  mission_complete: 0.0,
};
const SIGNED_STAGES = new Set(["mission_funded", "mission_active", "mission_complete"]);

type Json = Record<string, unknown>;

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

  // ── Range ─────────────────────────────────────────────────────────────────
  const url = new URL(req.url);
  const days = Math.max(1, Math.min(3650, Number(url.searchParams.get("days")) || 90));
  const fromISO = new Date(Date.now() - days * 86_400_000).toISOString();
  const nowISO = new Date().toISOString();

  // ── Activities (outreach + meetings) in range ───────────────────────────────
  const { data: activities } = await admin
    .from("crm_activities")
    .select("kind, platform, outcome, occurred_at")
    .gte("occurred_at", fromISO);

  const outreachByPlatform: Record<string, number> = {};
  const meetingsByOutcome: Record<string, number> = {};
  let outreachTotal = 0;
  let meetingsTotal = 0;
  for (const a of activities ?? []) {
    if (a.kind === "outreach") {
      outreachTotal++;
      outreachByPlatform[a.platform] = (outreachByPlatform[a.platform] ?? 0) + 1;
    } else if (a.kind === "meeting") {
      meetingsTotal++;
      const o = a.outcome ?? "booked";
      meetingsByOutcome[o] = (meetingsByOutcome[o] ?? 0) + 1;
    }
  }

  // ── Contacts: LinkedIn lead statuses + Cal.com appointments in range ─────────
  const { data: contacts } = await admin
    .from("crm_contacts")
    .select("custom_fields");

  const linkedinByStatus: Record<string, number> = {};
  let calcomBookedInRange = 0;
  for (const c of contacts ?? []) {
    const cf = (c.custom_fields ?? {}) as Json;
    const li = cf["linkedin"] as Json | undefined;
    if (li && typeof li === "object" && li["profile_url"]) {
      const st = String(li["status"] ?? "new");
      linkedinByStatus[st] = (linkedinByStatus[st] ?? 0) + 1;
    }
    const appt = cf["appointment"] as Json | undefined;
    const start = appt && typeof appt === "object" ? String(appt["start_time"] ?? "") : "";
    if (start && start >= fromISO && start <= nowISO) calcomBookedInRange++;
  }

  // ── Dojo revenue (service role bypasses RLS) ────────────────────────────────
  const [{ data: clients }, { data: briefings }, { data: msas }] = await Promise.all([
    admin.from("clients").select("id, pipeline_stage"),
    admin.from("briefings").select("client_id, upfront_mission_funding, monthly_mission_funding, status"),
    admin.from("msas").select("client_id, status").eq("status", "mission_authorized"),
  ]);

  const briefingByClient: Record<string, Json> = {};
  for (const b of (briefings ?? []) as Json[]) {
    const cid = String(b["client_id"]);
    const status = String(b["status"] ?? "");
    if (!briefingByClient[cid] || status === "ready" || status === "presented") {
      briefingByClient[cid] = b;
    }
  }
  const authorizedClientIds = new Set((msas ?? []).map((m: Json) => String(m["client_id"])));

  let confirmedMRR = 0;
  let weightedMRR = 0;
  let weightedUpfront = 0;
  let signedClients = 0;
  let activeClients = 0;

  for (const c of (clients ?? []) as Json[]) {
    const stage = String(c["pipeline_stage"] ?? "");
    const b = briefingByClient[String(c["id"])];
    const upfront = Number(b?.["upfront_mission_funding"] ?? 0);
    const monthly = Number(b?.["monthly_mission_funding"] ?? 0);
    const prob = STAGE_PROB[stage] ?? 0;

    if (SIGNED_STAGES.has(stage)) signedClients++;
    if (stage === "mission_active" && authorizedClientIds.has(String(c["id"]))) {
      confirmedMRR += monthly;
      activeClients++;
    }
    weightedMRR += monthly * prob;
    weightedUpfront += upfront * prob;
  }

  const avgDealMRR = activeClients > 0 ? confirmedMRR / activeClients : null;

  return NextResponse.json({
    range: { fromISO, toISO: nowISO, days },
    outreach: { total: outreachTotal, byPlatform: outreachByPlatform },
    meetings: { total: meetingsTotal, byOutcome: meetingsByOutcome, calcomBookedInRange },
    linkedin: { byStatus: linkedinByStatus },
    pipeline: {
      signedClients,
      activeClients,
      confirmedMRR,
      weightedMRR,
      weightedUpfront,
      avgDealMRR,
    },
  });
}
