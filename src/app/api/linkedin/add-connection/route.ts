/**
 * Ensure a LinkedIn connection exists in the CRM as an accepted contact.
 *
 * POST { connections: [{ name, profile_url?, company?, location?, title? }] }
 * Header: x-leads-secret must match LINKEDIN_CATCHER_SECRET (scoped, used by the
 * cloud catcher routine) or LEADS_API_SECRET (admin). See lib/crm/catcher-auth.
 *
 * Jeff sends LinkedIn connection invites manually as he browses. When someone
 * accepts, a morning routine posts the accepted people here. For each one:
 *
 *   - EXACTLY ONE existing contact matches the name  → mark that contact accepted,
 *     using the SAME additive custom_fields.linkedin write as mark-accepted
 *     (accepted=true, accepted_at, sequence_due=next available outreach day, and
 *     nothing else — sequence_step / *_sent_at / status / msg1/2/3 are preserved).
 *     Already accepted → reported as `already_accepted`, nothing written.
 *   - MORE THAN ONE contact matches → reported as `ambiguous`, nothing written.
 *   - ZERO matches → a brand-new contact is CREATED, marked accepted, tagged
 *     `linkedin-lead`, with NO msg1/msg2/msg3 and NO sequence_due, so the daily
 *     cold-message sequence engine never DMs someone Jeff already connected with.
 *
 * Matching is credential-tolerant: a single trailing credential/suffix token
 * (MD, DO, PhD, RN, Jr, III, …) is stripped from BOTH the incoming name and the
 * stored name before comparing, so "Radley Griffin MD" matches a stored
 * "Radley Griffin" and vice-versa.
 *
 * Idempotent: a created contact carries a linkedin object and the linkedin-lead
 * tag, so the very same name matches on the next run and is reported as
 * `already_accepted` — no duplicate is ever created.
 */
import { NextResponse } from "next/server";
import { authorizeCatcher } from "@/lib/crm/catcher-auth";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const connectionSchema = z.object({
  name: z.string().min(1, "Each connection needs a non-empty `name`"),
  profile_url: z.string().optional(),
  company: z.string().optional(),
  location: z.string().optional(),
  title: z.string().optional(),
});

const bodySchema = z.object({
  connections: z
    .array(connectionSchema, {
      required_error: "Body must include a `connections` array",
      invalid_type_error: "`connections` must be an array of connection objects",
    })
    .min(1, "`connections` must contain at least one connection")
    .max(200, "`connections` may contain at most 200 connections"),
});

interface ContactRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  custom_fields: Record<string, unknown> | null;
  tags: string[] | null;
}

/** A comparable existing (or freshly-created) contact. */
interface Candidate {
  id: string | null; // null for a contact created earlier in THIS request
  fullNorm: string;
  baseNorm: string;
  customFields: Record<string, unknown> | null;
  linkedin: Record<string, unknown> | null;
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

/**
 * Trailing credential / suffix tokens that should not block a name match. All
 * lowercase because they are compared against an already-normalised name.
 */
const CREDENTIAL_TOKENS = new Set([
  "md", "do", "dds", "dmd", "dvm", "phd", "rn", "np", "pa", "jr", "sr", "ii", "iii",
]);

/**
 * The credential-stripped base of an already-normalised full name: if the LAST
 * token (with trailing commas/periods removed) is a credential/suffix, drop it
 * and also clean trailing punctuation off the new final token. Only ONE trailing
 * token is ever stripped. Single-token names are returned unchanged so a bare
 * credential can never collapse to an empty string.
 */
function credentialBase(fullNorm: string): string {
  const tokens = fullNorm.split(" ").filter(Boolean);
  if (tokens.length <= 1) return fullNorm;
  const last = tokens[tokens.length - 1].replace(/[.,]+$/, "");
  if (!CREDENTIAL_TOKENS.has(last)) return fullNorm;
  const rest = tokens.slice(0, -1);
  rest[rest.length - 1] = rest[rest.length - 1].replace(/[.,]+$/, "");
  return rest.join(" ");
}

/** Two names match if their normalised full names OR credential-stripped bases are equal. */
function namesMatch(a: Candidate, b: { fullNorm: string; baseNorm: string }): boolean {
  return a.fullNorm === b.fullNorm || a.baseNorm === b.baseNorm;
}

/**
 * Split a display name into first / last for a new contact: strip a trailing
 * "'s", then the first token is first_name and every remaining token (including
 * any credential) is last_name (null when there is only one token).
 */
function splitName(displayName: string): { first: string; last: string | null } | null {
  const cleaned = displayName.replace(/[’']s$/i, "").trim().replace(/\s+/g, " ");
  const tokens = cleaned.split(" ").filter(Boolean);
  if (tokens.length === 0) return null;
  const first = tokens[0];
  const last = tokens.length > 1 ? tokens.slice(1).join(" ") : null;
  return { first, last };
}

/** A LinkedIn people-search link so an organic contact with no known profile still renders + is clickable. */
function linkedInSearchUrl(name: string): string {
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(name)}`;
}

/** True for the placeholder search link above — i.e. we never actually knew the profile. */
function isPlaceholderProfile(v: unknown): boolean {
  return typeof v === "string" && v.includes("/search/results/people/");
}

/**
 * Fill in profile_url / company / title / location on an EXISTING contact when the
 * caller supplies them and we don't already hold something better.
 *
 * A name-only record is not a usable lead — nobody can write an opener or open the
 * profile from it. The accept emails carry the headline and the real /in/ URL, so
 * when a later call brings them we upgrade in place.
 *
 * Strictly additive: a real stored value is never overwritten, and the placeholder
 * search link is treated as "unknown" so a real /in/ URL can replace it.
 * Returns the list of field names actually changed.
 */
function enrichLinkedIn(
  li: Record<string, unknown>,
  conn: { profile_url?: string; company?: string; title?: string; location?: string },
): string[] {
  const changed: string[] = [];

  const url = conn.profile_url?.trim();
  if (url && (!li.profile_url || isPlaceholderProfile(li.profile_url))) {
    li.profile_url = url;
    changed.push("profile_url");
  }

  for (const key of ["company", "title", "location"] as const) {
    const val = conn[key]?.trim();
    const cur = li[key];
    if (val && (typeof cur !== "string" || cur.trim() === "")) {
      li[key] = val;
      changed.push(key);
    }
  }

  return changed;
}

// ── Business-timezone date helpers (mirrors mark-accepted) ──────────────────────

/** Business timezone. Due dates are calendar days in Denver, not the server's UTC. */
const BUSINESS_TZ = "America/Denver";

/** Sequence steps that represent still-pending outreach work (i.e. not 'done'). */
const PENDING_STEPS = new Set(["msg1", "msg2", "msg3"]);

/** Today's calendar date in America/Denver as a "YYYY-MM-DD" string. */
function denverToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ }).format(new Date());
}

/** The calendar day after `ymd` ("YYYY-MM-DD"), incrementing the day component (DST-safe). */
function nextCalendarDay(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const yy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(next.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export async function POST(req: Request) {
  if (!authorizeCatcher(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json: unknown = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          "Invalid body — expected { connections: [{ name, profile_url?, company?, location?, title? }] }",
        details: parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`),
      },
      { status: 400 },
    );
  }

  // Dedupe by normalised name (keep the first occurrence's metadata) so a repeated
  // name in one payload can't be processed twice against a stale snapshot.
  const submitted = new Map<string, { display: string; conn: z.infer<typeof connectionSchema> }>();
  for (const conn of parsed.data.connections) {
    const key = normalizeName(conn.name);
    if (!key) {
      return NextResponse.json(
        { error: "Invalid body — `connections` contains a blank name" },
        { status: 400 },
      );
    }
    if (!submitted.has(key)) {
      submitted.set(key, { display: conn.name.trim().replace(/\s+/g, " "), conn });
    }
  }

  const admin = getSupabaseAdmin();

  // Candidate pool: the same population mark-accepted searches (contacts carrying a
  // custom_fields.linkedin object) UNION contacts carrying the `linkedin-lead` tag,
  // so a tag-only lead is matched too and never duplicated.
  const [liRes, tagRes] = await Promise.all([
    admin
      .from("crm_contacts")
      .select("id, first_name, last_name, custom_fields, tags")
      .not("custom_fields->linkedin", "is", null)
      .limit(1000),
    admin
      .from("crm_contacts")
      .select("id, first_name, last_name, custom_fields, tags")
      .contains("tags", ["linkedin-lead"])
      .limit(1000),
  ]);

  if (liRes.error) return NextResponse.json({ error: liRes.error.message }, { status: 500 });
  if (tagRes.error) return NextResponse.json({ error: tagRes.error.message }, { status: 500 });

  // Merge + dedupe the two result sets by id.
  const rowsById = new Map<string, ContactRow>();
  for (const row of [...(liRes.data ?? []), ...(tagRes.data ?? [])] as ContactRow[]) {
    if (!rowsById.has(row.id)) rowsById.set(row.id, row);
  }

  const candidates: Candidate[] = [];
  for (const row of rowsById.values()) {
    const hasLinkedIn = isLinkedInObject(row.custom_fields?.linkedin);
    const hasTag = (row.tags ?? []).includes("linkedin-lead");
    if (!hasLinkedIn && !hasTag) continue;
    const fullNorm = normalizeName(`${row.first_name ?? ""} ${row.last_name ?? ""}`);
    if (!fullNorm) continue;
    candidates.push({
      id: row.id,
      fullNorm,
      baseNorm: credentialBase(fullNorm),
      customFields: row.custom_fields,
      linkedin: hasLinkedIn ? (row.custom_fields!.linkedin as Record<string, unknown>) : null,
    });
  }

  // Next available outreach day, computed ONCE (mirrors mark-accepted): today's
  // Denver date if today still has pending scheduled outreach, otherwise tomorrow.
  const today = denverToday();
  const tomorrow = nextCalendarDay(today);
  let todayHasPendingWork = false;
  for (const c of candidates) {
    const li = c.linkedin;
    if (!li) continue;
    const due = typeof li.sequence_due === "string" ? li.sequence_due : null;
    const step = typeof li.sequence_step === "string" ? li.sequence_step : null;
    if (due === today && step !== null && PENDING_STEPS.has(step)) {
      todayHasPendingWork = true;
      break;
    }
  }
  const target = todayHasPendingWork ? today : tomorrow;
  const nowIso = new Date().toISOString();

  const created: string[] = [];
  const marked: string[] = [];
  const alreadyAccepted: string[] = [];
  const enriched: string[] = [];
  const ambiguous: string[] = [];
  const errors: { name: string; error: string }[] = [];

  for (const { display, conn } of submitted.values()) {
    const fullNorm = normalizeName(conn.name);
    const query = { fullNorm, baseNorm: credentialBase(fullNorm) };
    const matches = candidates.filter((c) => namesMatch(c, query));

    if (matches.length > 1) {
      ambiguous.push(display);
      continue;
    }

    if (matches.length === 1) {
      const m = matches[0];
      const wasAccepted = isAccepted(m.linkedin?.accepted);

      // Already accepted → nothing to flip, but we may still be able to UPGRADE a
      // name-only record with the headline/profile the accept email carried.
      if (wasAccepted) {
        if (m.id === null) {
          alreadyAccepted.push(display);
          continue;
        }

        const cfA: Record<string, unknown> = { ...(m.customFields ?? {}) };
        const liA: Record<string, unknown> = {
          ...(isLinkedInObject(cfA.linkedin) ? cfA.linkedin : {}),
        };
        const changed = enrichLinkedIn(liA, conn);

        if (changed.length === 0) {
          alreadyAccepted.push(display);
          continue;
        }

        cfA.linkedin = liA;
        const patchA: Record<string, unknown> = { custom_fields: cfA, updated_at: nowIso };
        if (changed.includes("company") && conn.company?.trim()) {
          patchA.company = conn.company.trim();
        }

        const { error: enrichErr } = await admin
          .from("crm_contacts")
          .update(patchA)
          .eq("id", m.id);

        if (enrichErr) {
          errors.push({ name: display, error: enrichErr.message });
          continue;
        }

        m.linkedin = liA;
        m.customFields = cfA;
        enriched.push(`${display} (${changed.join(", ")})`);
        continue;
      }

      // Should never fire (an unaccepted match always has a real id), but guard.
      if (m.id === null) {
        alreadyAccepted.push(display);
        continue;
      }

      // Additive jsonb write: spread the whole custom_fields object and the whole
      // nested linkedin object (empty object if a tag-only lead had none), then set
      // ONLY these three keys. Everything else survives untouched.
      const cf: Record<string, unknown> = { ...(m.customFields ?? {}) };
      const existingLi = isLinkedInObject(cf.linkedin) ? cf.linkedin : {};
      const li: Record<string, unknown> = { ...existingLi };
      li.accepted = true;
      li.accepted_at = nowIso;
      li.sequence_due = target;
      // Same upgrade as the already-accepted branch: if this call carries the
      // headline/profile, fill whatever we were missing.
      const markChanged = enrichLinkedIn(li, conn);
      cf.linkedin = li;

      const patch: Record<string, unknown> = { custom_fields: cf, updated_at: nowIso };
      if (markChanged.includes("company") && conn.company?.trim()) {
        patch.company = conn.company.trim();
      }

      const { error: updateErr } = await admin
        .from("crm_contacts")
        .update(patch)
        .eq("id", m.id);

      if (updateErr) {
        errors.push({ name: display, error: updateErr.message });
        continue;
      }

      // Reflect the accept in the in-memory pool so a later duplicate in this same
      // batch is reported as already_accepted rather than re-written.
      m.linkedin = li;
      m.customFields = cf;
      marked.push(display);
      continue;
    }

    // ── Zero matches → CREATE a new organic, accepted, no-sequence contact ──────
    const split = splitName(display);
    if (!split) {
      errors.push({ name: display, error: "Could not derive a first name" });
      continue;
    }

    const profileUrl = conn.profile_url?.trim() || linkedInSearchUrl(display);
    const li: Record<string, unknown> = {
      accepted: true,
      accepted_at: nowIso,
      added_at: nowIso,
      status: "connected",
      origin: "organic",
      sequence_step: "organic",
      profile_url: profileUrl,
    };
    if (conn.company?.trim()) li.company = conn.company.trim();
    if (conn.location?.trim()) li.location = conn.location.trim();
    if (conn.title?.trim()) li.title = conn.title.trim();

    const { data: inserted, error: insertErr } = await admin
      .from("crm_contacts")
      .insert({
        first_name: split.first,
        last_name: split.last,
        company: conn.company?.trim() || null,
        tags: ["linkedin-lead"],
        bucket: "active",
        is_active: true,
        date_entered: today,
        sequence_id: null,
        custom_fields: { linkedin: li },
      })
      .select("id")
      .single();

    if (insertErr) {
      errors.push({ name: display, error: insertErr.message });
      continue;
    }

    // Add to the in-memory pool so a duplicate (exact or credential variant) later
    // in this same batch matches it — keeps the batch itself idempotent.
    candidates.push({
      id: inserted?.id ?? null,
      fullNorm,
      baseNorm: query.baseNorm,
      customFields: { linkedin: li },
      linkedin: li,
    });
    created.push(display);
  }

  return NextResponse.json({
    created,
    marked,
    already_accepted: alreadyAccepted,
    enriched,
    ambiguous,
    errors,
  });
}
