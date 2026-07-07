/**
 * LinkedIn outreach lead ingestion.
 *
 * POST { leads: [{ name, title?, company?, profile_url, location? }] }
 * Header: x-leads-secret must match LEADS_API_SECRET.
 *
 * Each lead becomes a crm_contacts row tagged 'linkedin-lead' (inactive, no
 * date) with `custom_fields.linkedin` carrying the prospect data + status.
 * These are hidden from the main OCS views until they engage; the Social tab's
 * Outreach panel manages them. Dedupes on profile_url.
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const leadSchema = z.object({
  name: z.string().min(1),
  title: z.string().optional(),
  company: z.string().optional(),
  profile_url: z.string().url(),
  location: z.string().optional(),
});

const bodySchema = z.object({ leads: z.array(leadSchema).min(1).max(100) });

export async function POST(req: Request) {
  const secret = process.env.LEADS_API_SECRET;
  if (!secret || req.headers.get("x-leads-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json: unknown = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const lead of parsed.data.leads) {
    // Normalize: strip trailing slash so Batch-B and Batch-C urls match consistently
    const profileUrl = lead.profile_url.replace(/\/+$/, "");

    const { data: existing } = await admin
      .from("crm_contacts")
      .select("id")
      .eq("custom_fields->linkedin->>profile_url", profileUrl)
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      skipped++;
      continue;
    }

    const parts = lead.name.trim().split(/\s+/);
    const { error } = await admin.from("crm_contacts").insert({
      first_name: parts[0] ?? lead.name,
      last_name: parts.slice(1).join(" ") || null,
      company: lead.company ?? null,
      is_active: false,
      bucket: "alpha",
      next_action_date: null,
      tags: ["linkedin-lead"],
      custom_fields: {
        linkedin: {
          profile_url: profileUrl,
          title: lead.title ?? null,
          company: lead.company ?? null,
          location: lead.location ?? null,
          status: "new",
          added_at: new Date().toISOString(),
        },
      },
    });

    if (error) errors.push(`${lead.name}: ${error.message}`);
    else inserted++;
  }

  return NextResponse.json({ ok: true, inserted, skipped, errors });
}
