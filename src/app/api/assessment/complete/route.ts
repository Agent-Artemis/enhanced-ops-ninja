import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { persistFreeDeepDiveLead } from "@/lib/assessment/persist-deep-dive-lead";
import { saveAssessmentScore } from "@/lib/assessment/save-assessment-data";
import { assessmentConfigFilename, loadAssessmentConfig } from "@/lib/assessments/load";
import { ASSESSMENT_SESSION_COOKIE } from "@/lib/assessment/constants";
import { computeScores, scoreBand } from "@/lib/scoring/compute";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(320),
});

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Assessment storage is not configured" }, { status: 503 });
  }

  const json: unknown = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid name or email" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(ASSESSMENT_SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const { data: session, error: sessionError } = await admin
    .from("assessment_sessions")
    .select("id, track, tier, status")
    .eq("client_token", token)
    .maybeSingle();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  if (session.status === "completed") {
    const { data: existingScore } = await admin
      .from("assessment_scores")
      .select("overall_score, domain_scores")
      .eq("session_id", session.id)
      .maybeSingle();

    if (existingScore) {
      const filename = assessmentConfigFilename(
        session.tier as "free" | "paid",
        session.track as "healthcare" | "business",
      );
      const config = await loadAssessmentConfig(filename);
      const domainNameById = new Map(config.domains.map((d) => [d.id, d.name]));
      const domainScoresRaw = existingScore.domain_scores as Record<string, number>;
      const domainScores = Object.entries(domainScoresRaw).map(([domainId, score]) => ({
        domainId,
        name: domainNameById.get(domainId) ?? domainId,
        score: Number(score),
      }));
      domainScores.sort((a, b) => a.name.localeCompare(b.name));
      return NextResponse.json({
        ok: true,
        overallScore: existingScore.overall_score,
        domainScores,
        band: scoreBand(existingScore.overall_score),
      });
    }
  }

  if (session.status !== "in_progress") {
    return NextResponse.json({ error: "Session cannot be completed" }, { status: 409 });
  }

  const filename = assessmentConfigFilename(
    session.tier as "free" | "paid",
    session.track as "healthcare" | "business",
  );
  const config = await loadAssessmentConfig(filename);

  const { data: responses, error: respError } = await admin
    .from("assessment_responses")
    .select("question_id, choice_key")
    .eq("session_id", session.id);

  if (respError) {
    return NextResponse.json({ error: respError.message }, { status: 500 });
  }

  const answers: Record<string, string> = {};
  for (const row of responses ?? []) {
    if (row.question_id && row.choice_key) {
      answers[row.question_id] = row.choice_key;
    }
  }

  for (const q of config.questions) {
    if (!answers[q.id]) {
      return NextResponse.json({ error: "All questions must be answered first" }, { status: 400 });
    }
  }

  const computed = computeScores(config, answers);
  const domainScoresMap: Record<string, number> = {};
  for (const d of computed.domainScores) {
    domainScoresMap[d.domainId] = d.score;
  }

  const nowIso = new Date().toISOString();

  const { error: updateSessionError } = await admin
    .from("assessment_sessions")
    .update({
      name: parsed.data.name,
      email: parsed.data.email,
      contact_captured_at: nowIso,
      status: "completed",
      completed_at: nowIso,
    })
    .eq("id", session.id);

  if (updateSessionError) {
    return NextResponse.json({ error: updateSessionError.message }, { status: 500 });
  }

  const { error: scoreError } = await saveAssessmentScore(admin, {
    session_id: session.id,
    domain_scores: domainScoresMap,
    overall_score: computed.overallScore,
    scoring_version: computed.scoringVersion,
    computed_at: nowIso,
  });

  if (scoreError) {
    return NextResponse.json({ error: scoreError.message }, { status: 500 });
  }

  const deepDiveResult = await persistFreeDeepDiveLead(admin, {
    fullName: parsed.data.name,
    email: parsed.data.email,
    track: session.track,
    answers,
    overallScore: computed.overallScore,
  });

  if (deepDiveResult.error) {
    console.error("[assessment/complete] deep_dive_assessments insert failed:", deepDiveResult.error);
    return NextResponse.json({ error: deepDiveResult.error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    overallScore: computed.overallScore,
    domainScores: computed.domainScores.map((d) => ({
      domainId: d.domainId,
      name: d.name,
      score: d.score,
    })),
    band: scoreBand(computed.overallScore),
  });
}
