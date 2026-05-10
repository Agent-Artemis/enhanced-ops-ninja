import { randomBytes } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { assessmentConfigFilename, loadAssessmentConfig } from "@/lib/assessments/load";
import { ASSESSMENT_SESSION_COOKIE, ASSESSMENT_SESSION_COOKIE_MAX_AGE } from "@/lib/assessment/constants";
import { toPublicAssessmentPayload } from "@/lib/assessment/public-config";
import { scoreBand } from "@/lib/scoring/compute";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const createBodySchema = z.object({
  track: z.enum(["healthcare", "business"]),
  tier: z.enum(["free"]).default("free"),
});

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Assessment storage is not configured" }, { status: 503 });
  }

  const json: unknown = await req.json().catch(() => null);
  const parsed = createBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const filename = assessmentConfigFilename(parsed.data.tier, parsed.data.track);
  const config = await loadAssessmentConfig(filename);
  const token = randomBytes(32).toString("hex");

  const { data: session, error } = await admin
    .from("assessment_sessions")
    .insert({
      track: parsed.data.track,
      tier: parsed.data.tier,
      status: "in_progress",
      client_token: token,
    })
    .select("id")
    .single();

  if (error || !session) {
    return NextResponse.json({ error: error?.message ?? "Failed to create session" }, { status: 500 });
  }

  const cookieStore = await cookies();
  cookieStore.set(ASSESSMENT_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ASSESSMENT_SESSION_COOKIE_MAX_AGE,
  });

  return NextResponse.json({
    sessionId: session.id,
    config: toPublicAssessmentPayload(config),
  });
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Assessment storage is not configured" }, { status: 503 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(ASSESSMENT_SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ session: null });
  }

  const admin = getSupabaseAdmin();
  const { data: session, error: sessionError } = await admin
    .from("assessment_sessions")
    .select("id, track, tier, status, completed_at")
    .eq("client_token", token)
    .maybeSingle();

  if (sessionError || !session) {
    cookieStore.delete(ASSESSMENT_SESSION_COOKIE);
    return NextResponse.json({ session: null });
  }

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

  let results: {
    overallScore: number;
    domainScores: Array<{ domainId: string; name: string; score: number }>;
    band: ReturnType<typeof scoreBand>;
  } | null = null;

  if (session.status === "completed") {
    const { data: scoreRow } = await admin
      .from("assessment_scores")
      .select("overall_score, domain_scores")
      .eq("session_id", session.id)
      .maybeSingle();

    if (scoreRow) {
      const domainScoresRaw = scoreRow.domain_scores as Record<string, number> | null;
      const filename = assessmentConfigFilename(
        session.tier as "free" | "paid",
        session.track as "healthcare" | "business",
      );
      const config = await loadAssessmentConfig(filename);
      const domainNameById = new Map(config.domains.map((d) => [d.id, d.name]));
      const domainScores = Object.entries(domainScoresRaw ?? {}).map(([domainId, score]) => ({
        domainId,
        name: domainNameById.get(domainId) ?? domainId,
        score: Number(score),
      }));
      domainScores.sort((a, b) => a.name.localeCompare(b.name));
      results = {
        overallScore: scoreRow.overall_score,
        domainScores,
        band: scoreBand(scoreRow.overall_score),
      };
    }
  }

  return NextResponse.json({
    session: {
      id: session.id,
      track: session.track,
      tier: session.tier,
      status: session.status,
      answers,
      results,
    },
  });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(ASSESSMENT_SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
