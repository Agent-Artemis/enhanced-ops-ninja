/**
 * Server-side persistence for per-person notes on the public call-list pages
 * (enhancedops.ninja/lists/*). Those pages have no CRM auth session, so notes
 * used to live only in browser localStorage — which is per-browser and wiped on
 * iOS Safari / in-app browsers. This route stores them in Supabase instead so
 * they survive a refresh and follow the user across browsers/devices.
 *
 * Storage: crm_call_list_notes, unique on (list, person_key). person_key mirrors
 * the page's stable key(row) = tab + '|' + row.d + '|' + row.f.
 *
 * Guards: same-site origin check; service-role admin client (bypasses RLS).
 */
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const MAX_NOTE = 5000;

function sameSite(req: Request): boolean {
  const origin = req.headers.get("origin") || req.headers.get("referer") || "";
  // Empty origin (same-origin fetch with no header) is allowed, matching call-list-card.
  return !origin || /(^|\/\/|\.)enhancedops\.ninja/.test(origin);
}

// GET ?list=ut-snf-al → { ok:true, notes: { "<person_key>": "<note text>", ... } }
export async function GET(req: Request) {
  if (!sameSite(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const list = (url.searchParams.get("list") || "").trim().slice(0, 60);
  if (!list) {
    return NextResponse.json({ error: "list required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("crm_call_list_notes")
    .select("person_key, note")
    .eq("list", list);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const notes: Record<string, string> = {};
  for (const row of data || []) {
    const note = (row.note ?? "").toString();
    if (note.trim()) notes[row.person_key as string] = note;
  }

  return NextResponse.json({ ok: true, notes });
}

// POST { list, key, note } → upsert on (list, person_key); empty note → delete row.
export async function POST(req: Request) {
  if (!sameSite(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const list = String(body.list ?? "").trim().slice(0, 60);
  const key = String(body.key ?? "").trim().slice(0, 200);
  const note = String(body.note ?? "").slice(0, MAX_NOTE);

  if (!list) {
    return NextResponse.json({ error: "list required" }, { status: 400 });
  }
  if (!key) {
    return NextResponse.json({ error: "key required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // Empty/whitespace note → remove the row so GET stays clean.
  if (!note.trim()) {
    const { error } = await admin
      .from("crm_call_list_notes")
      .delete()
      .eq("list", list)
      .eq("person_key", key);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const { error } = await admin
    .from("crm_call_list_notes")
    .upsert(
      { list, person_key: key, note, updated_at: new Date().toISOString() },
      { onConflict: "list,person_key" }
    );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
