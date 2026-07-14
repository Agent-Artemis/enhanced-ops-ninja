/**
 * Mark LinkedIn leads as accepted.
 *
 * POST { names: ["Charlie Cameron", "Clint Flanagan MD"] }
 * Header: x-leads-secret must match LEADS_API_SECRET.
 *
 * A daily routine parses LinkedIn "X accepted your invitation" emails and posts
 * the names here. Matching is done on the full name (first_name + ' ' + last_name),
 * case-insensitive and whitespace-normalised, against crm_contacts rows that carry
 * a custom_fields.linkedin object.
 *
 * The ONLY things this endpoint writes are:
 *   custom_fields.linkedin.accepted     = true
 *   custom_fields.linkedin.accepted_at  = <now ISO>
 *   custom_fields.linkedin.sequence_due = <next available outreach day>
 *   updated_at                          = <now ISO>
 *
 * sequence_due is set ONLY on leads this call newly accepts, so a warm accept
 * surfaces promptly in the CRM Social tab instead of sitting on its old future
 * staggered date. The "next available outreach day" is computed ONCE per request
 * (so a batch of accepts all land on the same day): today's Denver date if today
 * still has pending outreach work scheduled, otherwise tomorrow's Denver date.
 * The Social tab already shows the correct post-accept welcome message for an
 * accepted lead — the only thing missing was the near-term due date.
 *
 * It STILL NEVER touches sequence_step, *_sent_at, status, msg1/msg2/msg3,
 * accepted_msg, or any other key — a previous bulk update advanced everyone's
 * sequence_step and destroyed the queue. Every other key in custom_fields is read,
 * spread, and written back untouched. It never creates a contact, and if a name
 * matches more than one contact it updates none of them (reported as `ambiguous`).
 * Idempotent: a second call with the same names returns them as `already_accepted`
 * and writes nothing (so an accepted lead's due date is never bumped again).
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  names: z
    .array(z.string().min(1, "Each name must be a non-empty string"), {
      required_error: "Body must include a `names` array of full-name strings",
      invalid_type_error: "`names` must be an array of full-name strings",
    })
    .min(1, "`names` must contain at least one name")
    .max(200, "`names` may contain at most 200 names"),
});

interface ContactRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  custom_fields: Record<string, unknown> | null;
}

/** Lowercase, trim, and collapse internal whitespace so " Clint  Flanagan MD " === "clint flanagan md". */
function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/** The linkedin block may carry accepted as a boolean or as a string ("true"). */
function isAccepted(value: unknown): boolean {
  return value === true || (typeof value === "string" && value.toLowerCase() === "true");
}

function isLinkedInObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Business timezone. Due dates are calendar days in Denver, not the server's UTC. */
const BUSINESS_TZ = "America/Denver";

/** Sequence steps that represent still-pending outreach work (i.e. not 'done'). */
const PENDING_STEPS = new Set(["msg1", "msg2", "msg3"]);

/** Today's calendar date in America/Denver as a "YYYY-MM-DD" string. */
function denverToday(): string {
  // en-CA formats as YYYY-MM-DD; timeZone pins it to the Denver calendar day.
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ }).format(new Date());
}

/**
 * The calendar day after `ymd` (a "YYYY-MM-DD" string), computed by incrementing
 * the day component itself — NOT by adding 86_400_000 ms to a UTC instant, which
 * can slip a day across a DST transition. Date.UTC rolls month/year over correctly.
 */
function nextCalendarDay(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const yy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(next.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export async function POST(req: Request) {
  const secret = process.env.LEADS_API_SECRET;
  if (!secret || req.headers.get("x-leads-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json: unknown = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          "Invalid body — expected { names: string[] } with at least one non-empty full name",
        details: parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`),
      },
      { status: 400 },
    );
  }

  // Dedupe the submitted names (by normalised form) so a repeated name in one
  // payload can't be processed twice against a stale snapshot.
  const submitted = new Map<string, string>();
  for (const name of parsed.data.names) {
    const key = normalizeName(name);
    if (!key) {
      return NextResponse.json(
        { error: "Invalid body — `names` contains a blank name" },
        { status: 400 },
      );
    }
    if (!submitted.has(key)) submitted.set(key, name.trim().replace(/\s+/g, " "));
  }

  const admin = getSupabaseAdmin();

  // Candidate pool: LinkedIn leads only. Name matching happens in JS.
  const { data: contacts, error } = await admin
    .from("crm_contacts")
    .select("id, first_name, last_name, custom_fields")
    .not("custom_fields->linkedin", "is", null)
    .limit(1000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Index the LinkedIn leads by normalised full name; a key can hold >1 row.
  const byName = new Map<string, ContactRow[]>();
  for (const row of (contacts ?? []) as ContactRow[]) {
    if (!isLinkedInObject(row.custom_fields?.linkedin)) continue;
    const full = normalizeName(`${row.first_name ?? ""} ${row.last_name ?? ""}`);
    if (!full) continue;
    const bucket = byName.get(full);
    if (bucket) bucket.push(row);
    else byName.set(full, [row]);
  }

  // Next available outreach day, computed ONCE so a whole batch of accepts lands
  // on the same date. Rule: "today if today's outreach isn't done, else tomorrow."
  // Today's outreach is "not done" iff at least one active LinkedIn lead is already
  // scheduled for today (sequence_due === today) with pending work (sequence_step in
  // msg1/msg2/msg3). We read this from the snapshot fetched above — before any write.
  const today = denverToday();
  const tomorrow = nextCalendarDay(today);
  let todayHasPendingWork = false;
  for (const row of (contacts ?? []) as ContactRow[]) {
    const li = row.custom_fields?.linkedin;
    if (!isLinkedInObject(li)) continue;
    const due = typeof li.sequence_due === "string" ? li.sequence_due : null;
    const step = typeof li.sequence_step === "string" ? li.sequence_step : null;
    if (due === today && step !== null && PENDING_STEPS.has(step)) {
      todayHasPendingWork = true;
      break;
    }
  }
  const target = todayHasPendingWork ? today : tomorrow;

  const marked: string[] = [];
  const alreadyAccepted: string[] = [];
  const notFound: string[] = [];
  const ambiguous: string[] = [];
  const errors: string[] = [];

  for (const [key, displayName] of submitted) {
    const matches = byName.get(key) ?? [];

    if (matches.length === 0) {
      // No match → report it. Never create a contact.
      notFound.push(displayName);
      continue;
    }

    if (matches.length > 1) {
      // Ambiguous → touch nothing.
      ambiguous.push(displayName);
      continue;
    }

    const row = matches[0];
    const linkedin = row.custom_fields!.linkedin as Record<string, unknown>;

    if (isAccepted(linkedin.accepted)) {
      alreadyAccepted.push(displayName);
      continue;
    }

    const nowIso = new Date().toISOString();

    // Additive jsonb write: spread the whole custom_fields object and the whole
    // nested linkedin object, then set ONLY these three keys. Everything else —
    // sequence_step, *_sent_at, status, msg1/msg2/msg3, accepted_msg, stack,
    // appointment, lead_source, … — survives untouched. sequence_due is set to the
    // next available outreach day so this newly-accepted lead surfaces promptly in
    // the Social tab (harmless even if sequence_step is already 'done').
    const cf: Record<string, unknown> = { ...row.custom_fields };
    const li: Record<string, unknown> = { ...linkedin };
    li.accepted = true;
    li.accepted_at = nowIso;
    li.sequence_due = target;
    cf.linkedin = li;

    const { error: updateErr } = await admin
      .from("crm_contacts")
      .update({ custom_fields: cf, updated_at: nowIso })
      .eq("id", row.id);

    if (updateErr) {
      errors.push(`${displayName}: ${updateErr.message}`);
      continue;
    }

    marked.push(displayName);
  }

  return NextResponse.json({
    marked,
    already_accepted: alreadyAccepted,
    not_found: notFound,
    ambiguous,
    errors,
  });
}
