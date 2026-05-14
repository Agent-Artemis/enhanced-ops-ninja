"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  DEEP_DIVE_QUESTION_COUNT,
  getDeepDiveModules,
  getDeepDiveQuestions,
  type DeepDiveChoiceLetter,
  type DeepDiveModuleMeta,
  type DeepDiveQuestion,
} from "@/lib/deep-dive/assessment-data";
import { moduleScorePercent, overallScorePercent, pointsForChoice } from "@/lib/deep-dive/assessment-scoring";
import {
  DEEP_DIVE_LS,
  parseBusinessType,
  readLocalStorage,
  type StoredBusinessType,
  writeLocalStorage,
} from "@/lib/deep-dive/assessment-storage";

type Screen =
  | { kind: "welcome" }
  | { kind: "moduleIntro"; moduleIndex: number }
  | { kind: "question"; questionIndex: number };

function buildScreens(modules: DeepDiveModuleMeta[], questionCount: number): Screen[] {
  const screens: Screen[] = [{ kind: "welcome" }];
  let qIdx = 0;
  for (const mod of modules) {
    screens.push({ kind: "moduleIntro", moduleIndex: mod.moduleIndex });
    for (let i = 0; i < mod.questionCount; i++) {
      if (qIdx >= questionCount) break;
      screens.push({ kind: "question", questionIndex: qIdx });
      qIdx++;
    }
  }
  return screens;
}

function computeScoresFromAnswers(
  questions: DeepDiveQuestion[],
  answers: Record<string, DeepDiveChoiceLetter>,
): { overallScore: number; moduleScores: Record<string, number> } {
  let totalPoints = 0;
  const agg: Record<number, { sum: number; count: number }> = {};
  for (const q of questions) {
    const letter = answers[q.id];
    if (!letter) continue;
    const p = pointsForChoice(letter);
    totalPoints += p;
    const slot = agg[q.moduleIndex] ?? { sum: 0, count: 0 };
    slot.sum += p;
    slot.count += 1;
    agg[q.moduleIndex] = slot;
  }
  const moduleScores: Record<string, number> = {};
  for (const [k, v] of Object.entries(agg)) {
    moduleScores[`module-${k}`] = moduleScorePercent(v.sum, v.count);
  }
  const overallScore = overallScorePercent(totalPoints, questions.length);
  return { overallScore, moduleScores };
}

const shellClass = "min-h-screen bg-[#000000] text-white";
const primaryBtnClass =
  "inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#1A6ECC] px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-[#1562b8] disabled:cursor-not-allowed disabled:opacity-45";
const secondaryBtnClass =
  "inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[rgb(26_110_204/0.45)] px-6 py-3 text-[15px] font-semibold text-[#1A6ECC] transition hover:bg-[rgb(26_110_204/0.12)] disabled:cursor-not-allowed disabled:opacity-45";
const choiceBtnBase =
  "w-full rounded-lg border px-4 py-3 text-left text-[15px] leading-snug transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A6ECC]";

function ProgressBar(props: { value: number }) {
  const pct = Math.max(0, Math.min(100, props.value));
  return (
    <div className="mb-8">
      <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.12em] text-[rgb(255_255_255/0.45)]">
        <span>Progress</span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[rgb(255_255_255/0.08)]">
        <div
          className="h-full rounded-full bg-[#1A6ECC] transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function MissingKeysScreen() {
  return (
    <div className={`${shellClass} px-6 py-16`}>
      <div className="mx-auto max-w-lg text-center">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#1A6ECC]">Deep dive</p>
        <h1 className="mb-4 font-[family-name:var(--font-bebas)] text-4xl uppercase tracking-[0.04em] text-white md:text-5xl">
          Almost there
        </h1>
        <p className="mb-8 text-[15px] leading-relaxed text-[rgb(255_255_255/0.65)]">
          We need your completed checkout details on this device (assessment reference, track, and
          contact info). Return to the deep dive flow to finish payment, or use the same browser you
          checked out with.
        </p>
        <Link href="/deep-dive" className={`${primaryBtnClass} w-full no-underline sm:w-auto`}>
          Back to deep dive checkout
        </Link>
        <p className="mt-8">
          <Link href="/" className="text-sm text-[#1A6ECC] underline-offset-4 hover:underline">
            Home
          </Link>
        </p>
      </div>
    </div>
  );
}

export function DeepDiveAssessmentWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [hydrated, setHydrated] = useState(false);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [businessType, setBusinessType] = useState<StoredBusinessType | null>(null);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [screenIndex, setScreenIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, DeepDiveChoiceLetter>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fromQuery = searchParams.get("deepDiveAssessmentId");
    if (fromQuery) {
      writeLocalStorage(DEEP_DIVE_LS.assessmentId, fromQuery);
    }
    setAssessmentId(readLocalStorage(DEEP_DIVE_LS.assessmentId));
    setBusinessType(parseBusinessType(readLocalStorage(DEEP_DIVE_LS.businessType)));
    setEmail(readLocalStorage(DEEP_DIVE_LS.email) ?? "");
    setFirstName(readLocalStorage(DEEP_DIVE_LS.firstName) ?? "");
    setHydrated(true);
  }, [searchParams]);

  const track = businessType;
  const modules = useMemo(() => (track ? getDeepDiveModules(track) : []), [track]);
  const questions = useMemo(() => (track ? getDeepDiveQuestions(track) : []), [track]);
  const screens = useMemo(() => {
    if (!track || questions.length === 0) return [{ kind: "welcome" as const }];
    return buildScreens(modules, questions.length);
  }, [modules, questions.length, track]);

  useEffect(() => {
    if (screenIndex >= screens.length) {
      setScreenIndex(Math.max(0, screens.length - 1));
    }
  }, [screenIndex, screens.length]);

  const current = screens[screenIndex] ?? { kind: "welcome" as const };
  const totalSteps = screens.length;
  const progressPct = totalSteps <= 1 ? 0 : (screenIndex / (totalSteps - 1)) * 100;

  const currentQuestion =
    current.kind === "question" ? questions[current.questionIndex] ?? null : null;
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;

  const setChoice = useCallback((letter: DeepDiveChoiceLetter) => {
    if (!currentQuestion) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: letter }));
  }, [currentQuestion]);

  const goBack = () => {
    setSubmitError(null);
    setScreenIndex((i) => Math.max(0, i - 1));
  };

  const goNext = () => {
    setSubmitError(null);
    setScreenIndex((i) => Math.min(totalSteps - 1, i + 1));
  };

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const firstNameValid = firstName.trim().length > 0;
  const requiredOk =
    assessmentId !== null &&
    assessmentId.length > 0 &&
    track !== null &&
    emailValid &&
    firstNameValid;

  const isLastScreen = screenIndex >= totalSteps - 1;

  const handlePrimaryAdvance = () => {
    if (current.kind === "question") {
      if (!currentAnswer) return;
      if (isLastScreen) {
        void submitAssessment();
        return;
      }
    }
    goNext();
  };

  const submitAssessment = async () => {
    if (!track || !assessmentId || questions.length !== DEEP_DIVE_QUESTION_COUNT) return;
    for (const q of questions) {
      if (!answers[q.id]) {
        setSubmitError("Please answer every question before submitting.");
        return;
      }
    }
    if (!emailValid || !firstNameValid) {
      setSubmitError("Missing valid email or first name in browser storage. Return to checkout.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    const { overallScore, moduleScores } = computeScoresFromAnswers(questions, answers);
    try {
      const res = await fetch("/api/complete-assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentId,
          answers,
          overallScore,
          moduleScores,
          email: email.trim(),
          firstName: firstName.trim(),
        }),
      });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          typeof json === "object" && json !== null && "error" in json && typeof (json as { error: unknown }).error === "string"
            ? (json as { error: string }).error
            : "Submission failed. Try again.";
        setSubmitError(msg);
        setSubmitting(false);
        return;
      }
      writeLocalStorage(DEEP_DIVE_LS.overallScore, String(overallScore));
      writeLocalStorage(DEEP_DIVE_LS.moduleScores, JSON.stringify(moduleScores));
      router.push("/deep-dive/score");
    } catch {
      setSubmitError("Network error. Check your connection and try again.");
      setSubmitting(false);
    }
  };

  if (!hydrated) {
    return (
      <div className={`${shellClass} px-6 py-16`}>
        <p className="mx-auto max-w-lg text-center text-sm text-[rgb(255_255_255/0.7)]">Loading…</p>
      </div>
    );
  }

  if (!requiredOk) {
    return <MissingKeysScreen />;
  }

  const moduleForIntro =
    current.kind === "moduleIntro" ? modules.find((m) => m.moduleIndex === current.moduleIndex) : null;

  const primaryLabel =
    current.kind === "welcome"
      ? "Start"
      : current.kind === "moduleIntro"
        ? "Begin questions"
        : isLastScreen
          ? "Submit assessment"
          : "Next";

  const primaryDisabled =
    submitting ||
    (current.kind === "question" && !currentAnswer) ||
    (current.kind === "question" && isLastScreen && !currentAnswer);

  return (
    <div className={shellClass}>
      <header className="border-b border-[rgb(255_255_255/0.08)] px-6 py-5">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
          <Link href="/" className="text-sm font-medium text-[rgb(255_255_255/0.65)] no-underline hover:text-white">
            ← Enhanced Ops × Ninja
          </Link>
          {screenIndex > 0 ? (
            <button type="button" className="text-sm font-medium text-[#1A6ECC] hover:underline" onClick={goBack}>
              Back
            </button>
          ) : (
            <Link href="/deep-dive" className="text-sm font-medium text-[#1A6ECC] no-underline hover:underline">
              Checkout
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10 pb-20">
        <ProgressBar value={progressPct} />

        {current.kind === "welcome" ? (
          <div className="text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#1A6ECC]">Deep dive assessment</p>
            <h1 className="mb-4 font-[family-name:var(--font-bebas)] text-[44px] uppercase leading-none tracking-[0.04em] md:text-[52px]">
              You&apos;re in
            </h1>
            <p className="mx-auto mb-4 max-w-xl text-[15px] leading-relaxed text-[rgb(255_255_255/0.68)]">
              Payment received — thank you. When you continue, you will walk through seven modules with
              multiple-choice questions designed to map operational strength across your organization.
            </p>
            <p className="mx-auto mb-10 max-w-xl text-sm text-[rgb(255_255_255/0.45)]">
              Track:{" "}
              <span className="font-semibold text-white">
                {track === "healthcare" ? "Healthcare" : "General business"}
              </span>
              {" · "}
              {DEEP_DIVE_QUESTION_COUNT} questions · about 45–60 minutes
            </p>
            <button type="button" className={primaryBtnClass} onClick={goNext}>
              {primaryLabel}
            </button>
          </div>
        ) : null}

        {current.kind === "moduleIntro" && moduleForIntro ? (
          <div className="rounded-xl border border-[rgb(26_110_204/0.25)] bg-[rgb(10_10_10)] p-8 md:p-10">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(255_255_255/0.45)]">
              Module {moduleForIntro.moduleIndex} of 7
            </p>
            <h2 className="mb-4 font-[family-name:var(--font-bebas)] text-[40px] uppercase leading-none tracking-[0.04em] text-[#1A6ECC]">
              {moduleForIntro.title}
            </h2>
            <p className="mb-8 text-[15px] leading-relaxed text-[rgb(255_255_255/0.7)]">
              This module contains{" "}
              <span className="font-semibold text-white">{moduleForIntro.questionCount} questions</span>.
              Choose the option that best reflects how your organization operates today.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
              <button type="button" className={secondaryBtnClass} onClick={goBack}>
                Back
              </button>
              <button type="button" className={`${primaryBtnClass} sm:min-w-[200px]`} onClick={goNext}>
                {primaryLabel}
              </button>
            </div>
          </div>
        ) : null}

        {current.kind === "question" && currentQuestion ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#1A6ECC]">
              Question {current.questionIndex + 1} of {questions.length}
            </p>
            <h2 className="mb-8 font-[family-name:var(--font-bebas)] text-3xl uppercase leading-tight tracking-[0.03em] text-white md:text-4xl">
              {currentQuestion.prompt}
            </h2>
            <div className="space-y-3">
              {(["A", "B", "C", "D"] as const).map((letter) => {
                const selected = currentAnswer === letter;
                return (
                  <button
                    key={letter}
                    type="button"
                    className={`${choiceBtnBase} ${
                      selected
                        ? "border-[#1A6ECC] bg-[rgb(26_110_204/0.18)] text-white"
                        : "border-[rgb(255_255_255/0.12)] bg-[rgb(10_10_10)] text-[rgb(255_255_255/0.88)] hover:border-[rgb(26_110_204/0.45)]"
                    }`}
                    onClick={() => setChoice(letter)}
                  >
                    <span className="font-bold text-[#1A6ECC]">{letter}.</span>{" "}
                    {currentQuestion.choices[letter]}
                  </button>
                );
              })}
            </div>
            {submitError ? (
              <p className="mt-6 text-sm text-red-400" role="alert">
                {submitError}
              </p>
            ) : null}
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-between">
              <button type="button" className={secondaryBtnClass} onClick={goBack}>
                Back
              </button>
              <button
                type="button"
                className={`${primaryBtnClass} sm:min-w-[200px]`}
                disabled={Boolean(primaryDisabled)}
                onClick={handlePrimaryAdvance}
              >
                {submitting ? "Submitting…" : primaryLabel}
              </button>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
