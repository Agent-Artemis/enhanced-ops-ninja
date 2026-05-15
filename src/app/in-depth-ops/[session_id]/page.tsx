import Link from "next/link";
import { redirect } from "next/navigation";

import { InDepthWizard } from "@/components/in-depth-ops/InDepthWizard";
import { IN_DEPTH_QUESTIONS } from "@/lib/in-depth-ops/questions";
import { createSupabaseAdmin } from "@/lib/ops-report/supabase-admin";

export const dynamic = "force-dynamic";

type AnswerRow = {
  question_key: string;
  answer_choice: string | null;
};

export default async function InDepthSessionPage({
  params,
}: {
  params: Promise<{ session_id: string }>;
}) {
  const { session_id } = await params;
  const supabase = createSupabaseAdmin();

  const { data: session, error } = await supabase
    .from("ops_assessment_sessions")
    .select("id,stripe_status,status")
    .eq("id", session_id)
    .single();

  if (error || !session) {
    redirect("/in-depth-ops");
  }

  if (session.stripe_status !== "paid") {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-16 text-slate-100">
        <div className="mx-auto max-w-xl rounded-2xl border border-slate-800 bg-slate-900/50 p-8">
          <h1 className="text-2xl font-semibold text-white">Payment required</h1>
          <p className="mt-3 text-slate-300">
            This session is not marked as paid yet. If you just finished checkout, wait a few seconds for the webhook to confirm,
            then refresh.
          </p>
          <Link className="mt-6 inline-block text-emerald-300 underline" href={`/in-depth-ops/${session_id}`}>
            Refresh
          </Link>
          <div className="mt-4">
            <Link className="text-sm text-slate-400 underline" href="/in-depth-ops">
              ← Back to start
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (session.status === "completed") {
    redirect(`/in-depth-ops/${session_id}/results`);
  }

  const { data: answerRows } = await supabase
    .from("ops_assessment_answers")
    .select("question_key,answer_choice")
    .eq("session_id", session_id);

  const initialAnswers: Record<string, "A" | "B" | "C" | "D"> = {};
  for (const row of (answerRows ?? []) as AnswerRow[]) {
    const c = row.answer_choice;
    if (c === "A" || c === "B" || c === "C" || c === "D") {
      initialAnswers[row.question_key] = c;
    }
  }

  let initialIndex = 0;
  for (let i = 0; i < IN_DEPTH_QUESTIONS.length; i += 1) {
    const key = IN_DEPTH_QUESTIONS[i]?.question_key;
    if (key && !initialAnswers[key]) {
      initialIndex = i;
      break;
    }
    initialIndex = i;
  }

  return (
    <main className="min-h-screen bg-slate-950">
      <InDepthWizard sessionId={session_id} initialAnswers={initialAnswers} initialIndex={initialIndex} />
    </main>
  );
}
