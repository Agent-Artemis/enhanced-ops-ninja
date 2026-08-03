/**
 * National SNF/AL Call List API — powers the "National Call List" section on the
 * CRM Call Lists tab. Jason (and Jeff) work this list to book meetings.
 *
 * Reads the unified `facility_call_list` view (snf_facilities ∪ al_facilities) via
 * the service-role admin client, joined to each facility's latest note/outcome from
 * `facility_call_notes`. All of these are RLS-locked, so the browser client can't
 * touch them — same guard as call-queue (JWT → @enhancedops.ninja / Jeff).
 *
 * GET  /api/crm/facility-call-list?type=snf|al|all&state=UT|all&q=&page=1&limit=50
 *   → { rows: [...], total, page, limit, facets: { states, byType } }
 *   Each row: { id, facility_source, facility_type, name, phone, address, city,
 *               state, zip, note, outcome, note_updated_at }
 *
 * POST /api/crm/facility-call-list
 *   { facility_source, facility_id, note?, outcome? }
 *   → upserts facility_call_notes AND inserts a crm_activities row attributed to
 *     Jason (platform='phone') so ReportsView aggregates the calling automatically.
 */
import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const JASON_EMAIL = "jason@enhancedops.ninja";

// Which outcomes map to a "meeting" activity vs plain "outreach".
const MEETING_OUTCOMES = new Set(["booked", "held", "no_show", "rescheduled", "won", "lost", "follow_up"]);

function isAllowed(email: string) {
  return email.endsWith("@enhancedops.ninja") || email === "jeff@augeo-hq.com";
}

async function authUser(req: Request) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const admin = getSupabaseAdmin();
  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(token);
  if (authError || !user?.email || !isAllowed(user.email)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { admin };
}

async function jasonId(admin: ReturnType<typeof getSupabaseAdmin>): Promise<string | null> {
  const { data } = await admin
    .from("crm_team_members")
    .select("id")
    .eq("email", JASON_EMAIL)
    .maybeSingle();
  return data?.id ?? null;
}

export async function GET(req: Request) {
  const { admin, error } = await authUser(req);
  if (error) return error;

  const url = new URL(req.url);
  const type = (url.searchParams.get("type") ?? "all").toLowerCase(); // snf|al|all
  const state = (url.searchParams.get("state") ?? "all").toUpperCase(); // 2-letter|ALL
  const q = (url.searchParams.get("q") ?? "").trim();
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 50));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = admin!
    .from("facility_call_list")
    .select("id, facility_source, facility_type, name, phone, address, city, state, zip", { count: "exact" });

  if (type === "snf" || type === "al") query = query.eq("facility_source", type);
  if (state !== "ALL" && /^[A-Z]{2}$/.test(state)) query = query.eq("state", state);
  if (q) query = query.or(`name.ilike.%${q}%,city.ilike.%${q}%`);

  const { data: rows, count, error: qErr } = await query
    .order("name", { ascending: true })
    .range(from, to);
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });

  // Attach each facility's latest note + last outcome.
  const list = rows ?? [];
  const snfIds = list.filter((r) => r.facility_source === "snf").map((r) => r.id);
  const alIds = list.filter((r) => r.facility_source === "al").map((r) => r.id);
  const notesByKey = new Map<string, { note: string | null; outcome: string | null; updated_at: string }>();
  for (const [src, ids] of [["snf", snfIds], ["al", alIds]] as const) {
    if (ids.length === 0) continue;
    const { data: notes } = await admin!
      .from("facility_call_notes")
      .select("facility_id, note, outcome, updated_at")
      .eq("facility_source", src)
      .in("facility_id", ids);
    for (const n of notes ?? []) notesByKey.set(`${src}:${n.facility_id}`, n);
  }

  const enriched = list.map((r) => {
    const n = notesByKey.get(`${r.facility_source}:${r.id}`);
    return { ...r, note: n?.note ?? null, outcome: n?.outcome ?? null, note_updated_at: n?.updated_at ?? null };
  });

  // Facets for the dropdowns (cheap — pre-aggregated view).
  const { data: facetRows } = await admin!
    .from("facility_call_list_states")
    .select("facility_source, facility_type, state, total, with_phone");

  return NextResponse.json({
    rows: enriched,
    total: count ?? 0,
    page,
    limit,
    facets: { states: facetRows ?? [] },
  });
}

export async function POST(req: Request) {
  const { admin, error } = await authUser(req);
  if (error) return error;

  const body = (await req.json().catch(() => null)) as
    | { facility_source?: string; facility_id?: string; note?: string; outcome?: string }
    | null;
  const source = body?.facility_source;
  const facilityId = body?.facility_id;
  if ((source !== "snf" && source !== "al") || !facilityId) {
    return NextResponse.json(
      { error: "Expected { facility_source: 'snf'|'al', facility_id: uuid, note?, outcome? }" },
      { status: 400 },
    );
  }
  const note = (body?.note ?? "").trim() || null;
  const outcome = body?.outcome?.trim() || null;
  const nowIso = new Date().toISOString();
  const author = await jasonId(admin!);

  // Upsert the per-facility note (one row per facility, keyed on source+id).
  const { error: nErr } = await admin!
    .from("facility_call_notes")
    .upsert(
      { facility_source: source, facility_id: facilityId, note, outcome, author_id: author, updated_at: nowIso },
      { onConflict: "facility_source,facility_id" },
    );
  if (nErr) return NextResponse.json({ error: nErr.message }, { status: 500 });

  // Mirror into crm_activities so ReportsView aggregates Jason's calling/scheduling.
  const kind = outcome && MEETING_OUTCOMES.has(outcome) && outcome !== "follow_up" ? "meeting" : "outreach";
  const activity: Record<string, unknown> = {
    contact_id: null,
    kind,
    platform: "phone",
    direction: "outbound",
    outcome: kind === "meeting" ? outcome : null,
    occurred_at: nowIso,
    body: note,
    author_id: author,
  };
  const { error: aErr } = await admin!.from("crm_activities").insert(activity);
  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, kind, outcome });
}
