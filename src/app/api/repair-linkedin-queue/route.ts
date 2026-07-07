/**
 * One-time repair: revert all linkedin leads incorrectly marked accepted=true
 * back to sequence_step='msg1', accepted=false.
 * Preserves sequence_due, accepted_msg, and all other fields.
 * Adam Kaplan (adam-kaplan-solera) is the ONLY genuine accept — excluded from revert.
 */
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const GENUINE_ACCEPTS = new Set(["https://linkedin.com/in/adam-kaplan-solera"]);

export async function GET(req: Request) {
  const secret = process.env.LEADS_API_SECRET;
  if (!secret || req.headers.get("x-leads-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();

  // Fetch all contacts where linkedin.accepted = true
  const { data: contacts, error } = await admin
    .from("crm_contacts")
    .select("id, custom_fields")
    .not("custom_fields->linkedin", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let reverted = 0;
  let kept = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const contact of contacts ?? []) {
    const cf = { ...(contact.custom_fields as Record<string, unknown>) };
    const li = { ...(cf.linkedin as Record<string, unknown>) };

    // Only touch contacts that were incorrectly flagged
    if (li.accepted !== true) { skipped++; continue; }

    const profileUrl = (li.profile_url as string ?? "").replace(/\/+$/, "");

    // Preserve genuine accepts
    if (GENUINE_ACCEPTS.has(profileUrl)) { kept++; continue; }

    // Revert: back to msg1, accepted=false
    // Preserve: sequence_due, accepted_msg, msg1/msg2/msg3, and all other fields
    li.sequence_step = "msg1";
    li.accepted = false;

    cf.linkedin = li;
    const { error: updateErr } = await admin
      .from("crm_contacts")
      .update({ custom_fields: cf })
      .eq("id", contact.id);

    if (updateErr) errors.push(`${contact.id}: ${updateErr.message}`);
    else reverted++;
  }

  return NextResponse.json({ ok: true, reverted, kept, skipped, errors });
}
