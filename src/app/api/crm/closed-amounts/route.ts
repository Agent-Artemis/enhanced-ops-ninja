/**
 * CRM closed-amounts endpoint.
 *
 * Powers the auto-fill of the Amount column in the Daily Activity Log. Uses the
 * service role so it can read the Dojo revenue tables (msas/briefings), which
 * are behind RLS the browser CRM client can't cross.
 *
 * A "closed" deal = a signed MSA (msas.status = 'mission_authorized'). The deal
 * dollar value is the linked briefing's upfront_mission_funding. Amounts are
 * bucketed by the LOCAL (America/Denver) calendar date of the MSA's
 * authorized_at timestamp (stored WITHOUT tz → treated as UTC, converted to MT).
 *
 * GET /api/crm/closed-amounts
 * Headers: Authorization: Bearer <supabase-jwt>  (an @enhancedops.ninja / Jeff user)
 * Response: { amounts: { 'YYYY-MM-DD': number } }
 */

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function isAllowed(email: string) {
  return email.endsWith("@enhancedops.ninja") || email === "jeff@augeo-hq.com";
}

/**
 * Convert a timestamp-without-tz value (treated as UTC) to its America/Denver
 * calendar date as YYYY-MM-DD.
 */
function denverDateISO(ts: string): string | null {
  // The stored value has no tz; append 'Z' so it's parsed as UTC.
  const iso = ts.includes("T") ? ts : ts.replace(" ", "T");
  const d = new Date(iso.endsWith("Z") || /[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  if (Number.isNaN(d.getTime())) return null;
  // en-CA yields YYYY-MM-DD; timeZone shifts to Mountain Time.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  return parts;
}

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

  // ── Signed MSAs + their briefing deal value ────────────────────────────────
  const { data: msas, error: msaError } = await admin
    .from("msas")
    .select("authorized_at, briefing_id, status")
    .eq("status", "mission_authorized");
  if (msaError) {
    return NextResponse.json({ error: msaError.message }, { status: 500 });
  }

  // Pull the upfront funding for the referenced briefings.
  const briefingIds = [
    ...new Set(
      (msas ?? [])
        .map((m: Json) => m["briefing_id"])
        .filter((id): id is string => Boolean(id))
        .map((id) => String(id)),
    ),
  ];

  const fundingByBriefing: Record<string, number> = {};
  if (briefingIds.length > 0) {
    const { data: briefings, error: bError } = await admin
      .from("briefings")
      .select("id, upfront_mission_funding")
      .in("id", briefingIds);
    if (bError) {
      return NextResponse.json({ error: bError.message }, { status: 500 });
    }
    for (const b of (briefings ?? []) as Json[]) {
      fundingByBriefing[String(b["id"])] = Number(b["upfront_mission_funding"] ?? 0);
    }
  }

  // ── Bucket by America/Denver calendar date of authorized_at ─────────────────
  const amounts: Record<string, number> = {};
  for (const m of (msas ?? []) as Json[]) {
    const authorizedAt = m["authorized_at"];
    if (!authorizedAt) continue;
    const dateISO = denverDateISO(String(authorizedAt));
    if (!dateISO) continue;
    const briefingId = m["briefing_id"] ? String(m["briefing_id"]) : "";
    const value = fundingByBriefing[briefingId] ?? 0;
    amounts[dateISO] = (amounts[dateISO] ?? 0) + value;
  }

  return NextResponse.json({ amounts });
}
