/**
 * Public email-capture opt-in from the static marketing asset pages.
 *
 * POST { email, firstName?, source?, page?, website? } — same-origin, no auth.
 *
 * Each opt-in becomes a crm_contacts row tagged 'inbound-lead' (inactive,
 * bucket 'alpha', no date) with `custom_fields.inbound` carrying provenance.
 * `website` is a honeypot: any non-empty value is a bot and is silently dropped.
 * Dedupes on email so re-submits never create duplicate cards.
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().email().transform((e) => e.trim().toLowerCase()),
  firstName: z.string().max(80).optional(),
  source: z.string().max(64).optional(),
  page: z.string().max(64).optional(),
  website: z.string().optional(),
});

export async function POST(req: Request) {
  const json: unknown = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { email, firstName, source, page, website } = parsed.data;

  // Honeypot — a real user never fills this hidden field. Silently accept + drop.
  if (typeof website === "string" && website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const admin = getSupabaseAdmin();

  const { data: existing } = await admin
    .from("crm_contacts")
    .select("id")
    .eq("email", email)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  const { error } = await admin.from("crm_contacts").insert({
    first_name: firstName?.trim() || email.split("@")[0],
    email,
    is_active: false,
    bucket: "alpha",
    next_action_date: null,
    tags: ["inbound-lead", ...(source ? [source] : [])],
    custom_fields: {
      inbound: {
        source: source ?? null,
        page: page ?? null,
        email,
        opted_in_at: new Date().toISOString(),
      },
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
