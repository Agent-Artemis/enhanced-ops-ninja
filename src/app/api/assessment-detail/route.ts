/**
 * Assessment detail for the dojo Deep Dive tab.
 *
 * The dojo (eon-app) can't read `deep_dive_assessments` directly (RLS). This
 * endpoint is the proper read channel: the dojo calls it with the logged-in
 * team user's Supabase JWT and a client email; we verify the caller is a team
 * member, then return the client's full assessment — every question with the
 * option they chose, grouped by scored domain.
 *
 * GET /api/assessment-detail?email=<client email>
 * Headers: Authorization: Bearer <dojo team-user JWT>
 */
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getDeepDiveQuestions, getDeepDiveModules } from "@/lib/deep-dive/assessment-data";
import type { BusinessTrack } from "@/lib/deep-dive/pricing";

export const dynamic = "force-dynamic";

const CORS_ORIGINS = [
  "https://dojo.enhancedops.ninja",
  "https://mission.enhancedops.ninja",
  "http://localhost:5173",
  "http://localhost:5174",
];

function corsHeaders(origin: string | null) {
  const allowed = origin && CORS_ORIGINS.includes(origin) ? origin : CORS_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };
}

export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function GET(req: Request) {
  const headers = corsHeaders(req.headers.get("origin"));
  const admin = getSupabaseAdmin();

  // ── Auth: valid JWT + caller is a team member ─────────────────────────────
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });

  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user?.email) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401, headers });
  }
  // Team gate: mirror the dojo's own model. Team members have a `users` row
  // (looked up by auth id, as AdminRoute does); plus the known team logins and
  // the @enhancedops.ninja domain. Clients (mission portal) have none of these.
  const callerEmail = user.email.toLowerCase();
  const TEAM_LOGINS = new Set(["jeff@augeo-hq.com", "demo@augeo-hq.com"]);
  let isTeam = callerEmail.endsWith("@enhancedops.ninja") || TEAM_LOGINS.has(callerEmail);
  if (!isTeam) {
    const { data: teamRow } = await admin
      .from("users").select("id").eq("id", user.id).maybeSingle();
    isTeam = Boolean(teamRow?.id);
  }
  if (!isTeam) {
    return NextResponse.json({ error: "Forbidden — team access only" }, { status: 403, headers });
  }

  // ── Load the target client's assessment ───────────────────────────────────
  const email = new URL(req.url).searchParams.get("email");
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400, headers });

  const { data: dd } = await admin
    .from("deep_dive_assessments")
    .select("assessment_answers, module_scores, assessment_score, business_type, assessment_completed_at, org_name")
    .ilike("email", email)
    .not("assessment_completed_at", "is", null)
    .order("assessment_completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!dd) return NextResponse.json({ ok: true, detail: null }, { headers });

  const track = (dd.business_type === "business" ? "business" : "healthcare") as BusinessTrack;
  const answers = (dd.assessment_answers as Record<string, string>) ?? {};
  const questions = getDeepDiveQuestions(track);
  const modules = getDeepDiveModules(track);
  const moduleScores = (dd.module_scores as Record<string, number>) ?? {};

  // Group questions (with the chosen option text) under their scored domain,
  // keyed by moduleIndex.
  const byIndex = new Map<number, { title: string; score: number | null; questions: { prompt: string; answer: string }[] }>();
  for (const mod of modules) {
    byIndex.set(mod.moduleIndex, {
      title: mod.title,
      score: moduleScores[`module-${mod.moduleIndex}`] ?? null,
      questions: [],
    });
  }
  for (const q of questions) {
    const bucket = byIndex.get(q.moduleIndex);
    if (!bucket) continue;
    const chosen = answers[q.id] as ("A" | "B" | "C" | "D" | undefined);
    const label = chosen ? q.choices[chosen] : undefined;
    bucket.questions.push({
      prompt: q.prompt,
      answer: label ? `${chosen}. ${label}` : (chosen ? String(chosen) : "—"),
    });
  }

  return NextResponse.json(
    {
      ok: true,
      detail: {
        org: dd.org_name ?? null,
        businessType: track,
        overall: dd.assessment_score,
        completed: dd.assessment_completed_at,
        domains: Array.from(byIndex.values()),
      },
    },
    { headers },
  );
}
