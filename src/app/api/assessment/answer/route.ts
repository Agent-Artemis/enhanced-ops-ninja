import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { ASSESSMENT_SESSION_COOKIE } from "@/lib/assessment/constants";
import { saveAssessmentResponse } from "@/lib/assessment/save-assessment-data";
import { pointsForChoice } from "@/lib/scoring/points";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  questionId: z.string().min(1),
  choiceKey: z.enum(["A", "B", "C", "D"]),
});

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Assessment storage is not configured" }, { status: 503 });
  }

  const json: unknown = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(ASSESSMENT_SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const { data: session, error: sessionError } = await admin
    .from("assessment_sessions")
    .select("id, status")
    .eq("client_token", token)
    .maybeSingle();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  if (session.status !== "in_progress") {
    return NextResponse.json({ error: "Session is not editable" }, { status: 409 });
  }

  const points = pointsForChoice(parsed.data.choiceKey);

  const { error } = await saveAssessmentResponse(admin, {
    session_id: session.id,
    question_id: parsed.data.questionId,
    choice_key: parsed.data.choiceKey,
    points,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
