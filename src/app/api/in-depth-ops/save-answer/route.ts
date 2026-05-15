import { NextResponse } from "next/server";
import { z } from "zod";

import { getQuestionByKey } from "@/lib/in-depth-ops/questions";
import { createSupabaseAdmin } from "@/lib/ops-report/supabase-admin";
import { pointsForChoice } from "@/lib/ops-report/report-builder";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  session_id: z.string().uuid(),
  question_key: z.string().min(3).max(32),
  answer_choice: z.enum(["A", "B", "C", "D"]),
});

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown error";
}

export async function POST(req: Request) {
  const json: unknown = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { session_id, question_key, answer_choice } = parsed.data;
  const points = pointsForChoice(answer_choice);
  if (points === null) {
    return NextResponse.json({ error: "Invalid answer choice" }, { status: 400 });
  }

  const q = getQuestionByKey(question_key);
  if (!q) {
    return NextResponse.json({ error: "Unknown question_key" }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdmin();
    const { data: session, error: sessionError } = await supabase
      .from("ops_assessment_sessions")
      .select("id,stripe_status,status")
      .eq("id", session_id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.stripe_status !== "paid") {
      return NextResponse.json({ error: "Payment required before answering" }, { status: 402 });
    }

    if (session.status === "completed") {
      return NextResponse.json({ error: "Session already completed" }, { status: 409 });
    }

    await supabase.from("ops_assessment_answers").delete().eq("session_id", session_id).eq("question_key", question_key);

    const insert = await supabase.from("ops_assessment_answers").insert({
      session_id,
      module_number: q.module_number,
      module_name: q.module_name,
      question_number: q.question_number,
      question_key,
      question_text: q.question_text,
      answer_choice,
      answer_points: points,
    });

    if (insert.error) {
      return NextResponse.json({ error: insert.error.message }, { status: 500 });
    }

    const nextStatus = session.status === "not_started" ? "in_progress" : session.status;
    if (nextStatus !== session.status) {
      await supabase.from("ops_assessment_sessions").update({ status: nextStatus }).eq("id", session_id);
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
