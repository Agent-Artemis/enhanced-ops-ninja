/**
 * LinkedIn sequence loader.
 *
 * POST { sequences: [...] }
 * Header: x-leads-secret must match LEADS_API_SECRET.
 *
 * For each entry, looks up crm_contacts by custom_fields->linkedin->>profile_url
 * and merges sequence_step / sequence_due / msg1 / msg2 / msg3 /
 * msg2_asset / msg3_asset into custom_fields.linkedin.
 * All other existing fields (profile_url, title, company, status, etc.) are preserved.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const sequenceSchema = z.object({
  profile_url:   z.string().url(),
  sequence_step: z.enum(["msg1", "msg2", "msg3", "done"]),
  sequence_due:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD").optional(),
  msg1:          z.string().min(1).optional(),
  msg2:          z.string().min(1).optional(),
  msg3:          z.string().min(1).optional(),
  msg2_asset:    z.string().optional(),
  msg3_asset:    z.string().optional(),
  accepted:      z.boolean().optional(),
  accepted_msg:  z.string().optional(),
});

const bodySchema = z.object({ sequences: z.array(sequenceSchema).min(1).max(200) });

const SEQUENCE_KEYS = [
  "sequence_step", "sequence_due",
  "msg1", "msg2", "msg3",
  "msg2_asset", "msg3_asset",
  "accepted", "accepted_msg",
] as const;

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
  let updated = 0;
  let notFound = 0;
  const errors: string[] = [];
  const missing: string[] = [];

  for (const entry of parsed.data.sequences) {
    const profileUrl = entry.profile_url.replace(/\/+$/, "");

    // Try normalized (no slash) first, then with slash for legacy Batch-B rows
    let contact: { id: string; custom_fields: unknown } | null = null;
    let fetchErr = null;

    for (const urlVariant of [profileUrl, profileUrl + "/"]) {
      const { data, error } = await admin
        .from("crm_contacts")
        .select("id, custom_fields")
        .eq("custom_fields->linkedin->>profile_url", urlVariant)
        .limit(1)
        .maybeSingle();
      if (error) { fetchErr = error; break; }
      if (data) { contact = data; break; }
    }

    if (fetchErr) {
      errors.push(`${entry.profile_url}: ${fetchErr.message}`);
      continue;
    }

    if (!contact) {
      missing.push(entry.profile_url);
      notFound++;
      continue;
    }

    // Merge only sequence fields — preserve everything else
    const cf = { ...(contact.custom_fields as Record<string, unknown> ?? {}) };
    const li = { ...(cf.linkedin as Record<string, unknown> ?? {}) };

    for (const key of SEQUENCE_KEYS) {
      if (entry[key] !== undefined) li[key] = entry[key];
    }

    cf.linkedin = li;

    const { error: updateErr } = await admin
      .from("crm_contacts")
      .update({ custom_fields: cf })
      .eq("id", contact.id);

    if (updateErr) errors.push(`${entry.profile_url}: ${updateErr.message}`);
    else updated++;
  }

  return NextResponse.json({
    ok: true,
    updated,
    not_found: notFound,
    errors,
    missing, // full list of unmatched profile_urls for easy debugging
  });
}
