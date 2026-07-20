/**
 * One-pager funnel stats for the CRM Reports tab.
 *
 * GET /api/crm/one-pager-stats
 * Headers: Authorization: Bearer <supabase-jwt>  (an @enhancedops.ninja / Jeff user)
 *
 * Joins page_opens (open-tracking pixel hits) against crm_contacts to show the
 * offers-sent → opened → booked funnel for the operational-gaps one-pager.
 */

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function isAllowed(email: string) {
  return email.endsWith("@enhancedops.ninja") || email === "jeff@augeo-hq.com";
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

  // ── Data ──────────────────────────────────────────────────────────────────
  const [{ data: opensRaw }, { data: contacts }] = await Promise.all([
    admin
      .from("page_opens")
      .select("contact_id, token, opened_at")
      .eq("page", "operational-gaps")
      .eq("is_bot", false)
      .order("opened_at", { ascending: false }),
    admin.from("crm_contacts").select("id, first_name, last_name, custom_fields"),
  ]);

  const opens = opensRaw ?? [];

  // id → name map + funnel counts derived from contacts
  const nameById = new Map<string, string>();
  const bookedIds = new Set<string>();
  let offersSent = 0;
  let bookedTotal = 0;

  for (const c of contacts ?? []) {
    const id = String((c as Json)["id"]);
    const name = `${(c as Json)["first_name"] ?? ""} ${(c as Json)["last_name"] ?? ""}`.trim();
    if (name) nameById.set(id, name);

    const cf = ((c as Json)["custom_fields"] ?? {}) as Json;
    const li = cf["linkedin"] as Json | undefined;
    if (li && typeof li === "object" && li["meeting_invite_sent_at"]) offersSent++;

    if (cf["appointment"]) {
      bookedTotal++;
      bookedIds.add(id);
    }
  }

  // ── Opens aggregates ────────────────────────────────────────────────────────
  const total = opens.length;
  const people = new Set<string>();
  const openerContactIds = new Set<string>();
  for (const o of opens) {
    const contactId = (o as Json)["contact_id"] as string | null;
    const tok = (o as Json)["token"] as string | null;
    people.add(String(contactId || tok || ""));
    if (contactId) openerContactIds.add(String(contactId));
  }

  const recent = opens.slice(0, 20).map((o) => {
    const contactId = (o as Json)["contact_id"] as string | null;
    return {
      name: (contactId && nameById.get(String(contactId))) || "Anonymous",
      openedAt: (o as Json)["opened_at"] as string,
      contactId: contactId ?? null,
    };
  });

  let bookedFromOpeners = 0;
  for (const id of openerContactIds) if (bookedIds.has(id)) bookedFromOpeners++;

  return NextResponse.json({
    page: "operational-gaps",
    offersSent,
    opens: { people: people.size, total, recent },
    booked: bookedTotal,
    bookedFromOpeners,
  });
}
