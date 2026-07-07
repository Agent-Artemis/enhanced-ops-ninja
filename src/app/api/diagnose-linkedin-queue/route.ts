/**
 * Diagnose and optionally restagger the LinkedIn Social tab queue.
 *
 * GET — secured with x-leads-secret header.
 *
 * 1. Fetches all crm_contacts that have a linkedin custom_field with a
 *    non-null sequence_step.
 * 2. Categorises msg1 leads by sequence_due date (today / tomorrow / day3 /
 *    null-or-other).
 * 3. If fewer than 15 leads have sequence_due === '2026-07-07' (today's queue
 *    is broken), restagger ALL eligible msg1 leads:
 *      first 20  → '2026-07-07'
 *      next  18  → '2026-07-08'
 *      rest      → '2026-07-09'
 *    Excluded: Adam Kaplan (profile_url contains 'adam-kaplan-solera'),
 *              Kyle Scott (name contains 'Kyle Scott'), leads tagged 'done',
 *              or sequence_step === 'done'.
 */
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const DATE_TODAY    = "2026-07-07";
const DATE_TOMORROW = "2026-07-08";
const DATE_DAY3     = "2026-07-09";
const RESTAGGER_THRESHOLD = 15;

const BUCKETS: [string, number][] = [
  [DATE_TODAY,    20],
  [DATE_TOMORROW, 18],
  // remaining → DATE_DAY3
];

interface LinkedInFields {
  sequence_step?: string;
  sequence_due?: string;
  profile_url?: string;
  [key: string]: unknown;
}

interface ContactRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  custom_fields: Record<string, unknown> | null;
  tags: string[] | null;
}

export async function GET(req: Request) {
  const secret = process.env.LEADS_API_SECRET;
  if (!secret || req.headers.get("x-leads-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();

  // Fetch all contacts that have a linkedin custom_field block
  const { data: contacts, error } = await admin
    .from("crm_contacts")
    .select("id, first_name, last_name, custom_fields, tags")
    .not("custom_fields->linkedin", "is", null)
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (contacts ?? []) as ContactRow[];

  // --- Filter: must have a non-null sequence_step --------------------------
  const withStep = rows.filter((c) => {
    const li = c.custom_fields?.linkedin as LinkedInFields | undefined;
    return li && li.sequence_step != null;
  });

  // --- Isolate msg1 leads --------------------------------------------------
  const msg1Leads = withStep.filter((c) => {
    const li = c.custom_fields!.linkedin as LinkedInFields;
    return li.sequence_step === "msg1";
  });

  // --- Categorise by sequence_due -----------------------------------------
  let dueToday    = 0;
  let dueTomorrow = 0;
  let dueDay3     = 0;
  let dueNullOrOther = 0;
  const unexpectedDues = new Set<string>();

  for (const c of msg1Leads) {
    const li  = c.custom_fields!.linkedin as LinkedInFields;
    const due = li.sequence_due ?? null;

    if (due === DATE_TODAY)    { dueToday++;    continue; }
    if (due === DATE_TOMORROW) { dueTomorrow++; continue; }
    if (due === DATE_DAY3)     { dueDay3++;     continue; }

    dueNullOrOther++;
    if (due) unexpectedDues.add(due);
  }

  // --- Decide whether to restagger ----------------------------------------
  const needsRestagger = dueToday < RESTAGGER_THRESHOLD;
  let restaggered      = false;
  const restaggerCounts: Record<string, number> = {};
  const skippedUrls: string[] = [];

  if (needsRestagger) {
    // Determine eligible leads
    const eligible: ContactRow[] = [];

    for (const c of msg1Leads) {
      const li   = c.custom_fields!.linkedin as LinkedInFields;
      const tags = c.tags ?? [];
      const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
      const profileUrl = li.profile_url ?? "";

      const isAdamKaplan = profileUrl.includes("adam-kaplan-solera");
      const isKyleScott  = name.toLowerCase().includes("kyle scott");
      const isDoneTag    = tags.includes("done");
      const isDoneStep   = li.sequence_step === "done";

      if (isAdamKaplan || isKyleScott || isDoneTag || isDoneStep) {
        skippedUrls.push(profileUrl || name);
        continue;
      }

      eligible.push(c);
    }

    // Sort deterministically by id
    eligible.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

    // Assign dates according to bucket sizes
    let cursor = 0;
    const assignments: Array<{ contact: ContactRow; date: string }> = [];

    for (const [date, count] of BUCKETS) {
      const slice = eligible.slice(cursor, cursor + count);
      for (const contact of slice) {
        assignments.push({ contact, date });
      }
      cursor += count;
    }
    // remaining
    for (const contact of eligible.slice(cursor)) {
      assignments.push({ contact, date: DATE_DAY3 });
    }

    // Persist each update (merge only sequence_due)
    const updateErrors: string[] = [];

    for (const { contact, date } of assignments) {
      const cf = { ...(contact.custom_fields as Record<string, unknown>) };
      const li = { ...(cf.linkedin as Record<string, unknown>) };
      li.sequence_due = date;
      cf.linkedin = li;

      const { error: updateErr } = await admin
        .from("crm_contacts")
        .update({ custom_fields: cf })
        .eq("id", contact.id);

      if (updateErr) {
        updateErrors.push(`${contact.id}: ${updateErr.message}`);
      } else {
        restaggerCounts[date] = (restaggerCounts[date] ?? 0) + 1;
      }
    }

    restaggered = updateErrors.length === 0;

    if (updateErrors.length > 0) {
      return NextResponse.json(
        {
          error:          "Some updates failed",
          update_errors:  updateErrors,
          restaggerCounts,
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    msg1_due_today:        dueToday,
    msg1_due_tomorrow:     dueTomorrow,
    msg1_due_day3:         dueDay3,
    msg1_null_or_other_due: dueNullOrOther,
    unexpected_dues:       Array.from(unexpectedDues),
    restaggered,
    restagger_counts:      restaggered ? restaggerCounts : null,
    skipped:               skippedUrls.length ? skippedUrls : null,
  });
}
