/**
 * Granola → CRM Action Items auto-ingest.
 *
 * Runs on a Vercel Cron a few times through the workday. Each run:
 *   1. Lists recent Granola meetings (last INGEST_WINDOW_DAYS).
 *   2. Skips any meeting already ingested (idempotent by granola_note_id — a
 *      meeting is never double-loaded).
 *   3. Parses each new meeting's "Next Steps" / "Action Items" section into
 *      discrete action items (bold title + owner + description).
 *   4. Matches the meeting to a CRM contact by attendee name / company; files
 *      the items against that contact, or leaves them unmatched.
 *   5. Inserts them into crm_action_items so they surface in the Action Items tab.
 *
 * Auth: protected by CRON_SECRET. Vercel Cron sends `Authorization: Bearer
 * $CRON_SECRET` automatically; manual runs may pass `?secret=$CRON_SECRET`.
 *
 * Env: GRANOLA_API_KEY, CRON_SECRET, NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY.
 */
import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GRANOLA_BASE = "https://public-api.granola.ai/v1";
const INGEST_WINDOW_DAYS = 4;
const LIST_LIMIT = 30;
/** Jeff's own identities — never treated as the "other party" for contact match. */
const SELF_EMAILS = new Set(["jeff@augeo-hq.com", "jeff@enhancedops.ninja"]);

type GranolaListNote = { id: string; title?: string; created_at?: string };
type GranolaAttendee = { name?: string; email?: string };
type GranolaDetail = {
  id: string;
  title?: string;
  created_at?: string;
  attendees?: GranolaAttendee[];
  summary_markdown?: string;
};
type ParsedItem = { text: string; owner: string | null };

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret;
}

async function granola<T>(path: string, key: string): Promise<T> {
  const res = await fetch(`${GRANOLA_BASE}${path}`, {
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Granola ${path} → ${res.status} ${await res.text().catch(() => "")}`);
  }
  return (await res.json()) as T;
}

/**
 * Pull discrete action items out of a meeting summary. We only read the
 * "Next Steps" / "Action Items" section so narrative bullets elsewhere don't
 * leak in. Format (from Granola): `- **Title** (Owner)` then an indented
 * description paragraph.
 */
function extractActionItems(md: string): ParsedItem[] {
  if (!md) return [];
  const lines = md.split(/\r?\n/);

  // Find the section heading.
  const headingRe = /^\s*(?:#{1,6}\s*|\*\*)\s*(next steps|action items)\b/i;
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (headingRe.test(lines[i])) { start = i + 1; break; }
  }
  if (start === -1) return [];

  // Collect until the next heading / horizontal rule / transcript footer link.
  const stopRe = /^\s*(?:#{1,6}\s|---|\*\*\s*[A-Za-z].*\*\*\s*$|\[.*\]\(https:\/\/notes\.granola)/;
  const block: string[] = [];
  for (let i = start; i < lines.length; i++) {
    if (stopRe.test(lines[i]) && !/^\s*[-*+]\s/.test(lines[i])) break;
    block.push(lines[i]);
  }

  const boldBulletRe = /^\s*[-*+]\s+\*\*(.+?)\*\*\s*(?:\(([^)]*)\))?\s*(.*)$/;
  const plainBulletRe = /^\s*[-*+]\s+(.+?)\s*$/;

  type Draft = { title: string; owner: string | null; desc: string[] };
  const drafts: Draft[] = [];
  let cur: Draft | null = null;
  let sawBold = false;

  for (const raw of block) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) continue;
    const bold = line.match(boldBulletRe);
    if (bold) {
      sawBold = true;
      cur = { title: bold[1].trim(), owner: (bold[2] || "").trim() || null, desc: [] };
      const trailing = (bold[3] || "").trim();
      if (trailing) cur.desc.push(trailing);
      drafts.push(cur);
      continue;
    }
    if (/^\s*[-*+]\s/.test(line)) {
      // A plain (non-bold) bullet: only used as a fallback item when the
      // section has no bold items at all; otherwise it's a sub-point.
      const plain = line.match(plainBulletRe);
      if (plain && !sawBold) {
        const ownerM = plain[1].match(/\(([^)]*)\)\s*$/);
        cur = {
          title: plain[1].replace(/\s*\([^)]*\)\s*$/, "").trim(),
          owner: ownerM ? ownerM[1].trim() : null,
          desc: [],
        };
        drafts.push(cur);
      } else if (cur) {
        cur.desc.push(plain ? plain[1].trim() : line.trim());
      }
      continue;
    }
    // Continuation / description line.
    if (cur) cur.desc.push(line.trim());
  }

  const items: ParsedItem[] = [];
  for (const d of drafts) {
    const title = d.title.replace(/\s+/g, " ").trim();
    if (!title) continue;
    let desc = d.desc.join(" ").replace(/\s+/g, " ").trim();
    if (desc.length > 400) desc = `${desc.slice(0, 397)}…`;
    let text = desc ? `${title} — ${desc}` : title;
    const ownerLc = (d.owner || "").toLowerCase();
    const ownerIsJeff = ownerLc === "jeff" || ownerLc === "jeff oldroyd";
    if (d.owner && !ownerIsJeff) text += ` (owner: ${d.owner})`;
    items.push({ text, owner: d.owner });
  }
  return items;
}

type ContactRow = { id: string; first_name: string | null; last_name: string | null; company: string | null };

function matchContact(
  attendees: GranolaAttendee[],
  contacts: ContactRow[],
): { contactId: string | null; confidence: "matched" | "unmatched" } {
  const others = attendees.filter((a) => !SELF_EMAILS.has((a.email || "").toLowerCase()));
  const byName = new Map<string, string>();
  const byCompany = new Map<string, string>();
  for (const c of contacts) {
    const full = `${c.first_name || ""} ${c.last_name || ""}`.replace(/\s+/g, " ").trim().toLowerCase();
    if (full) byName.set(full, c.id);
    if (c.company) byCompany.set(c.company.trim().toLowerCase(), c.id);
  }
  for (const a of others) {
    const nm = (a.name || "").replace(/\s+/g, " ").trim().toLowerCase();
    if (!nm) continue;
    const hit = byName.get(nm) || byCompany.get(nm);
    if (hit) return { contactId: hit, confidence: "matched" };
  }
  return { contactId: null, confidence: "unmatched" };
}

async function run(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const key = process.env.GRANOLA_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "GRANOLA_API_KEY not configured" }, { status: 500 });
  }

  const supabase = getSupabaseAdmin();
  const cutoff = Date.now() - INGEST_WINDOW_DAYS * 86_400_000;

  // 1. Recent meetings.
  const list = await granola<{ notes?: GranolaListNote[] }>(`/notes?limit=${LIST_LIMIT}`, key);
  const recent = (list.notes || []).filter((n) => {
    const t = n.created_at ? Date.parse(n.created_at) : NaN;
    return Number.isFinite(t) && t >= cutoff;
  });

  // 2. Which are already ingested?
  const { data: existing, error: exErr } = await supabase
    .from("crm_action_items")
    .select("granola_note_id")
    .in("granola_note_id", recent.map((n) => n.id));
  if (exErr) throw new Error(`existing lookup: ${exErr.message}`);
  const seen = new Set((existing || []).map((r) => r.granola_note_id));
  const fresh = recent.filter((n) => !seen.has(n.id));

  // Contacts for matching (small table; fetch once).
  const { data: contacts, error: cErr } = await supabase
    .from("crm_contacts")
    .select("id, first_name, last_name, company");
  if (cErr) throw new Error(`contacts: ${cErr.message}`);

  const report: Array<{ meeting: string; items: number; contact: string }> = [];
  let inserted = 0;

  for (const note of fresh) {
    const detail = await granola<GranolaDetail>(`/notes/${note.id}`, key);
    const items = extractActionItems(detail.summary_markdown || "");
    if (items.length === 0) {
      report.push({ meeting: note.title || note.id, items: 0, contact: "—" });
      continue;
    }
    const attendees = detail.attendees || [];
    const { contactId, confidence } = matchContact(attendees, (contacts as ContactRow[]) || []);
    const attendeeNames = attendees.map((a) => a.name || a.email || "").filter(Boolean);

    const rows = items.map((it) => ({
      source: "granola",
      granola_note_id: note.id,
      meeting_title: detail.title || note.title || "Untitled meeting",
      meeting_date: detail.created_at || note.created_at || null,
      attendees: attendeeNames,
      contact_id: contactId,
      match_confidence: confidence,
      item_text: it.text,
      status: "open",
    }));
    const { error: insErr } = await supabase.from("crm_action_items").insert(rows);
    if (insErr) throw new Error(`insert for ${note.id}: ${insErr.message}`);
    inserted += rows.length;
    report.push({ meeting: detail.title || note.id, items: rows.length, contact: confidence });
  }

  return NextResponse.json({
    ok: true,
    scanned: recent.length,
    new_meetings: fresh.length,
    items_inserted: inserted,
    detail: report,
  });
}

export async function GET(req: Request) {
  try {
    return await run(req);
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
