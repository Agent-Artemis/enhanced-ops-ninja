"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";

import { IN_DEPTH_QUESTIONS } from "@/lib/in-depth-ops/questions";

type AnswerMap = Record<string, "A" | "B" | "C" | "D">;

export function InDepthWizard(props: {
  sessionId: string;
  initialAnswers: AnswerMap;
  initialIndex: number;
}) {
  const [answers, setAnswers] = useState<AnswerMap>(props.initialAnswers);
  const [index, setIndex] = useState(props.initialIndex);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isSaving, setIsSaving] = useState(false);

  const total = IN_DEPTH_QUESTIONS.length;
  const current = IN_DEPTH_QUESTIONS[index];
  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);

  const persist = async (key: string, choice: "A" | "B" | "C" | "D"): Promise<boolean> => {
    const res = await fetch("/api/in-depth-ops/save-answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: props.sessionId, question_key: key, answer_choice: choice }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Could not save answer");
      return false;
    }
    return true;
  };

  const choose = (choice: "A" | "B" | "C" | "D") => {
    if (!current) return;
    startTransition(async () => {
      setError(null);
      setIsSaving(true);
      const ok = await persist(current.question_key, choice);
      setIsSaving(false);
      if (!ok) return;
      setAnswers((prev) => ({ ...prev, [current.question_key]: choice }));
      setIndex((i) => Math.min(i + 1, total - 1));
    });
  };

  const goBack = () => setIndex((i) => Math.max(i - 1, 0));

  const submitAssessment = () => {
    startTransition(async () => {
      setError(null);
      if (answeredCount < total) {
        setError("Please answer every question before submitting.");
        return;
      }
      const res = await fetch("/api/ops-report/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: props.sessionId }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string; ok?: boolean } | null;
      if (!res.ok || !body?.ok) {
        setError(body?.error ?? "Could not complete assessment");
        return;
      }
      window.location.href = `/in-depth-ops/${props.sessionId}/results`;
    });
  };

  if (!current) {
    return <p className="text-slate-200">Loading…</p>;
  }

  const progress = Math.round(((index + 1) / total) * 100);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 text-slate-100">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Link href="/in-depth-ops" className="text-sm text-slate-300 underline">
          ← Back
        </Link>
        <div className="text-sm text-slate-300">
          Question {index + 1} / {total}
        </div>
      </div>

      <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6 shadow-xl">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-300/90">Module {current.module_number}</p>
        <h1 className="mt-2 font-semibold text-2xl text-white">{current.module_name}</h1>
        <p className="mt-4 text-lg leading-relaxed text-slate-200">{current.question_text}</p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {(["A", "B", "C", "D"] as const).map((choice) => {
            const labels: Record<typeof choice, string> = {
              A: "Strongest / most mature",
              B: "Solid with minor gaps",
              C: "Inconsistent / needs work",
              D: "Weak / not in place",
            };
            const active = answers[current.question_key] === choice;
            return (
              <button
                key={choice}
                type="button"
                disabled={isPending || isSaving}
                onClick={() => choose(choice)}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  active
                    ? "border-emerald-400 bg-emerald-500/10 text-white"
                    : "border-slate-700 bg-slate-900/40 text-slate-100 hover:border-emerald-400/60"
                }`}
              >
                <div className="text-sm font-semibold text-emerald-200">{choice}</div>
                <div className="text-sm text-slate-300">{labels[choice]}</div>
              </button>
            );
          })}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={goBack}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
          >
            Previous
          </button>
          <div className="text-sm text-slate-400">{answeredCount} answered</div>
        </div>

        {answeredCount === total ? (
          <div className="mt-8 border-t border-slate-800 pt-6">
            <button
              type="button"
              disabled={isPending}
              onClick={submitAssessment}
              className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-center text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
            >
              {isPending ? "Submitting…" : "Submit assessment & generate report"}
            </button>
          </div>
        ) : null}

        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
      </div>
    </div>
  );
}
