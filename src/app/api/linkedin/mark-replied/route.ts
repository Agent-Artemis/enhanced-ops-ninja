/**
 * Reply ingest — server half of LinkedIn reply detection.
 *
 * Vercel cannot read Gmail; an external agent (Artemis) detects replies and
 * feeds full names here.
 *
 * POST /api/linkedin/mark-replied
 * Header: x-leads-secret must match LEADS_API_SECRET.
 * Body:   { "names": ["James Lee", "Bob DeClue"] }
 *
 * Matching: full name `first_name || ' ' || last_name`, case-insensitive,
 * trimmed. Only LinkedIn leads (custom_fields.linkedin present) are considered.
 *
 * For each match this sets, additively on custom_fields.linkedin:
 *   replied = true, replied_at = <now ISO>, sequence_step = 'replied'
 * and clears sequence_due (null) so the lead never resurfaces. It never touches
 * msg*_sent_at or accepted.
 *
 * Idempotent: a lead already replied=true is reported under already_replied and
 * left untouched. Returns { matched, not_found, already_replied }.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  names: z.array(z.string().min(1)).min(1).max(500),
});

interface ContactRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  custom_fields: Record<string, unknown> | null;
}

function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

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

  // Pull all LinkedIn leads once and match in memory (case-insensitive, trimmed).
  const { data, error } = await admin
    .from("crm_contacts")
    .select("id, first_name, last_name, custom_fields")
    .not("custom_fields->linkedin", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as ContactRow[];

  // Index contacts by normalized full name → rows (dup names possible).
  const byName = new Map<string, ContactRow[]>();
  for (const r of rows) {
    const full = normalizeName(`${r.first_name ?? ""} ${r.last_name ?? ""}`);
    if (!full) continue;
    const arr = byName.get(full) ?? [];
    arr.push(r);
    byName.set(full, arr);
  }

  const matched: string[] = [];
  const notFound: string[] = [];
  const alreadyReplied: string[] = [];
  const errors: string[] = [];

  // De-dup the requested names so a repeated name is processed once.
  const requested = Array.from(new Set(parsed.data.names.map(normalizeName))).filter(Boolean);

  for (const name of requested) {
    const hits = byName.get(name);
    if (!hits || hits.length === 0) {
      notFound.push(name);
      continue;
    }

    let didMark = false;
    let allAlready = true;

    for (const contact of hits) {
      const cf = { ...(contact.custom_fields ?? {}) };
      const li = { ...(cf.linkedin as Record<string, unknown> ?? {}) };

      // Idempotent: skip leads already replied.
      if (li.replied === true) continue;
      allAlready = false;

      // Additive update — preserve all other linkedin + custom_fields keys.
      // Never touch msg*_sent_at or accepted.
      li.replied = true;
      li.replied_at = new Date().toISOString();
      li.sequence_step = "replied";
      li.sequence_due = null;
      li.status = "replied";
      cf.linkedin = li;

      const { error: updErr } = await admin
        .from("crm_contacts")
        .update({ custom_fields: cf })
        .eq("id", contact.id);

      if (updErr) errors.push(`${name} (${contact.id}): ${updErr.message}`);
      else didMark = true;
    }

    if (didMark) matched.push(name);
    else if (allAlready) alreadyReplied.push(name);
  }

  return NextResponse.json({
    matched,
    not_found: notFound,
    already_replied: alreadyReplied,
    ...(errors.length ? { errors } : {}),
  });
}
