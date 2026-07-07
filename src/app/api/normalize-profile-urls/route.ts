/**
 * One-time migration: strip trailing slashes from custom_fields.linkedin.profile_url.
 * GET with header x-leads-secret to run.
 */
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.LEADS_API_SECRET;
  if (!secret || req.headers.get("x-leads-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();

  const { data: contacts, error } = await admin
    .from("crm_contacts")
    .select("id, custom_fields")
    .like("custom_fields->linkedin->>profile_url", "%/");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let updated = 0;
  const errors: string[] = [];

  for (const contact of contacts ?? []) {
    const cf = { ...(contact.custom_fields as Record<string, unknown>) };
    const li = { ...(cf.linkedin as Record<string, unknown>) };
    li.profile_url = (li.profile_url as string).replace(/\/+$/, "");
    cf.linkedin = li;

    const { error: updateErr } = await admin
      .from("crm_contacts")
      .update({ custom_fields: cf })
      .eq("id", contact.id);

    if (updateErr) errors.push(`${contact.id}: ${updateErr.message}`);
    else updated++;
  }

  return NextResponse.json({ ok: true, updated, total: contacts?.length ?? 0, errors });
}
