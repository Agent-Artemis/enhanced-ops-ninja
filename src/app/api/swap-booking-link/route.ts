/**
 * One-time migration: replace Google Calendar booking URL with Cal.com URL
 * in all linkedin msg1/msg2/msg3/accepted_msg fields.
 * GET with header x-leads-secret to run.
 */
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const OLD_URL = "https://calendar.app.google/JPqDPdCQNxDu8qtb6";
const NEW_URL = "https://enhancedops.ninja/book";
const FIELDS = ["msg1", "msg2", "msg3", "accepted_msg"] as const;

export async function GET(req: Request) {
  const secret = process.env.LEADS_API_SECRET;
  if (!secret || req.headers.get("x-leads-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();

  // Fetch all contacts that have any linkedin message field containing the old URL
  const { data: contacts, error } = await admin
    .from("crm_contacts")
    .select("id, custom_fields")
    .not("custom_fields->linkedin", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const contact of contacts ?? []) {
    const cf = { ...(contact.custom_fields as Record<string, unknown>) };
    const li = { ...(cf.linkedin as Record<string, unknown>) };

    let changed = false;
    for (const field of FIELDS) {
      const val = li[field];
      if (typeof val === "string" && val.includes(OLD_URL)) {
        li[field] = val.replaceAll(OLD_URL, NEW_URL);
        changed = true;
      }
    }

    if (!changed) { skipped++; continue; }

    cf.linkedin = li;
    const { error: updateErr } = await admin
      .from("crm_contacts")
      .update({ custom_fields: cf })
      .eq("id", contact.id);

    if (updateErr) errors.push(`${contact.id}: ${updateErr.message}`);
    else updated++;
  }

  return NextResponse.json({ ok: true, updated, skipped, errors });
}
