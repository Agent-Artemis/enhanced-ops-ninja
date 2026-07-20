/**
 * Log inbound replies from LinkedIn leads so they surface at the TOP of the
 * Social tab's daily queue as priority "respond first" items.
 *
 * POST {
 *   replies: [
 *     { name: "Clint Flanagan MD", source: "linkedin", snippet?: "...", email?: "...", ref?: "..." },
 *     ...
 *   ]
 * }
 * Header: x-leads-secret must match LEADS_API_SECRET.
 *
 * A daily routine parses LinkedIn notification emails ("X sent you a message")
 * and inbound email replies, then posts the sender names here. Matching mirrors
 * mark-accepted: the full name (first_name + ' ' + last_name), case-insensitive
 * and whitespace-normalised (so "Clint Flanagan MD" matches as stored), against
 * crm_contacts rows carrying a custom_fields.linkedin object. When the reply came
 * by email and an `email` is supplied, crm_contacts.email is also matched
 * case-insensitively.
 *
 * Per reply:
 *   • Exactly ONE matched lead → stamp custom_fields.linkedin.replied_at = now,
 *     reply_source = source, replied_handled_at = null, and sequence_due = today
 *     (Denver) so it shows in today's queue. Every other key is spread through
 *     untouched. If the lead is already pending a reply (replied_at set AND
 *     replied_handled_at null) it is skipped and reported in `already_flagged`.
 *   • ZERO or MULTIPLE matches → upserted into `inbound_replies` (deduped per
 *     name+source+day) so Jeff still sees "someone messaged you — reply on
 *     LinkedIn" even when we can't tie it to a card. Reported in `unmatched`.
 *
 * Per-item work is wrapped so one failure never aborts the batch.
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  replies: z
    .array(
      z.object({
        name: z.string().min(1, "Each reply must have a non-empty name"),
        source: z.enum(["linkedin", "email"], {
          required_error: "source must be 'linkedin' or 'email'",
          invalid_type_error: "source must be 'linkedin' or 'email'",
        }),
        snippet: z.string().optional(),
        email: z.string().optional(),
        ref: z.string().optional(),
      }),
      {
        required_error: "Body must include a `replies` array",
        invalid_type_error: "`replies` must be an array of reply objects",
      },
    )
    .min(1, "`replies` must contain at least one reply")
    .max(200, "`replies` may contain at most 200 replies"),
});

interface ContactRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  custom_fields: Record<string, unknown> | null;
}

/** Lowercase, trim, and collapse internal whitespace so " Clint  Flanagan MD " === "clint flanagan md". */
function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function isLinkedInObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Business timezone. Due dates are calendar days in Denver, not the server's UTC. */
const BUSINESS_TZ = "America/Denver";

/** Today's calendar date in America/Denver as a "YYYY-MM-DD" string. */
function denverToday(): string {
  // en-CA formats as YYYY-MM-DD; timeZone pins it to the Denver calendar day.
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ }).format(new Date());
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
          "Invalid body — expected { replies: [{ name, source: 'linkedin'|'email', snippet?, email?, ref? }] }",
        details: parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`),
      },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdmin();
  const today = denverToday();

  // Candidate pool: LinkedIn leads only. Name/email matching happens in JS.
  const { data: contacts, error } = await admin
    .from("crm_contacts")
    .select("id, first_name, last_name, email, custom_fields")
    .not("custom_fields->linkedin", "is", null)
    .limit(1000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Index the LinkedIn leads by normalised full name and by lowercased email;
  // a key can hold >1 row.
  const byName = new Map<string, ContactRow[]>();
  const byEmail = new Map<string, ContactRow[]>();
  for (const row of (contacts ?? []) as ContactRow[]) {
    if (!isLinkedInObject(row.custom_fields?.linkedin)) continue;
    const full = normalizeName(`${row.first_name ?? ""} ${row.last_name ?? ""}`);
    if (full) {
      const b = byName.get(full);
      if (b) b.push(row);
      else byName.set(full, [row]);
    }
    const em = (row.email ?? "").trim().toLowerCase();
    if (em) {
      const b = byEmail.get(em);
      if (b) b.push(row);
      else byEmail.set(em, [row]);
    }
  }

  const matched: string[] = [];
  const alreadyFlagged: string[] = [];
  const unmatched: string[] = [];
  const errors: string[] = [];

  for (const reply of parsed.data.replies) {
    const displayName = reply.name.trim().replace(/\s+/g, " ");
    try {
      // Collect candidate rows: by full name, plus by email for email replies.
      const candidates = new Map<string, ContactRow>();
      for (const r of byName.get(normalizeName(reply.name)) ?? []) candidates.set(r.id, r);
      if (reply.source === "email" && reply.email) {
        for (const r of byEmail.get(reply.email.trim().toLowerCase()) ?? []) candidates.set(r.id, r);
      }
      const matches = Array.from(candidates.values());

      if (matches.length === 1) {
        const row = matches[0];
        const linkedin = row.custom_fields!.linkedin as Record<string, unknown>;

        // Already pending a reply? Leave it (don't bump the timestamp).
        if (linkedin.replied_at && !linkedin.replied_handled_at) {
          alreadyFlagged.push(displayName);
          continue;
        }

        const nowIso = new Date().toISOString();

        // Additive jsonb write: spread the whole custom_fields object and the
        // whole nested linkedin object, then set ONLY the reply keys + push the
        // due date to today so it lands in today's queue. Every other key
        // survives untouched.
        const cf: Record<string, unknown> = { ...row.custom_fields };
        const li: Record<string, unknown> = { ...linkedin };
        li.replied_at = nowIso;
        li.reply_source = reply.source;
        li.replied_handled_at = null;
        li.sequence_due = today;
        cf.linkedin = li;

        const { error: updateErr } = await admin
          .from("crm_contacts")
          .update({ custom_fields: cf, updated_at: nowIso })
          .eq("id", row.id);

        if (updateErr) {
          errors.push(`${displayName}: ${updateErr.message}`);
          continue;
        }

        matched.push(displayName);
        continue;
      }

      // ZERO or MULTIPLE matches → record as an unmatched inbound reply. Dedup
      // per name+source+day so same-day re-runs don't duplicate the row.
      const dedupKey = `${reply.name.trim().toLowerCase()}|${reply.source}|${today}`;
      const { error: upsertErr } = await admin
        .from("inbound_replies")
        .upsert(
          {
            name: displayName,
            source: reply.source,
            snippet: reply.snippet ?? null,
            ref: reply.ref ?? null,
            dedup_key: dedupKey,
          },
          { onConflict: "dedup_key", ignoreDuplicates: true },
        );

      if (upsertErr) {
        errors.push(`${displayName}: ${upsertErr.message}`);
        continue;
      }

      unmatched.push(displayName);
    } catch (e) {
      errors.push(`${displayName}: ${e instanceof Error ? e.message : "unknown error"}`);
    }
  }

  return NextResponse.json({
    matched,
    already_flagged: alreadyFlagged,
    unmatched,
    errors,
  });
}
