/**
 * Per-person "OCS" button on the public call-list pages (enhancedops.ninja/lists/*).
 * Those pages have no CRM auth session, so they can't insert via the browser client.
 * This route uses the service-role admin client to mint a crm_contacts card that
 * lands in the CRM's "Action Needed" section (is_active + no next_action_date).
 *
 * Guards: same-site origin check, strict name/phone validation, and dedupe by a
 * stable per-person key so repeat taps don't pile up duplicate cards.
 */
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function digitsOnly(s: string): string {
  return (s || "").replace(/\D/g, "");
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin") || req.headers.get("referer") || "";
  if (origin && !/(^|\/\/|\.)enhancedops\.ninja/.test(origin)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  // ── Remove (un-OCS): delete the card this list previously created ──────────
  if (body.action === "remove") {
    const key = String(body.key ?? "").trim().slice(0, 160);
    if (!key) {
      return NextResponse.json({ error: "key required" }, { status: 400 });
    }
    const admin = getSupabaseAdmin();
    // Scoped to call-list cards only, so we can never delete a real contact.
    const { error } = await admin
      .from("crm_contacts")
      .delete()
      .eq("custom_fields->>call_list_key", key)
      .eq("custom_fields->>source", "call-list");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, removed: true });
  }

  const name = String(body.name ?? "").trim();
  const phoneRaw = String(body.phone ?? "").trim();
  const facility = String(body.facility ?? "").trim();
  const city = String(body.city ?? "").trim();
  const tab = body.tab === "snf" ? "snf" : "al";
  const listId = String(body.list ?? "call-list").trim().slice(0, 60);
  const key = String(body.key ?? "").trim().slice(0, 160);

  if (!name || digitsOnly(phoneRaw).length < 10) {
    return NextResponse.json({ error: "name and a valid phone are required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // Dedupe on the stable per-person key.
  if (key) {
    const { data: existing } = await admin
      .from("crm_contacts")
      .select("id")
      .eq("custom_fields->>call_list_key", key)
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      return NextResponse.json({ ok: true, id: existing.id, deduped: true });
    }
  }

  const parts = name.split(/\s+/);
  const firstName = parts.shift() || name;
  const lastName = parts.length ? parts.join(" ") : null;

  const { data: created, error } = await admin
    .from("crm_contacts")
    .insert({
      first_name: firstName,
      last_name: lastName,
      company: facility || null,
      phone: phoneRaw || null,
      is_active: true, // → Action Needed
      bucket: "active",
      next_action_date: null,
      tags: ["call-list", listId],
      custom_fields: {
        source: "call-list",
        call_list: listId,
        call_list_tab: tab,
        call_list_key: key,
        city,
      },
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (created?.id) {
    const bits = [facility && `Facility: ${facility}`, city && `City: ${city}`, phoneRaw && `Phone: ${phoneRaw}`]
      .filter(Boolean)
      .join(" · ");
    await admin.from("crm_notes").insert({
      contact_id: created.id,
      body: `Added from the ${tab === "snf" ? "SNF" : "AL"} call list (${listId}).${bits ? "\n" + bits : ""}`,
    });
  }

  return NextResponse.json({ ok: true, id: created?.id });
}
