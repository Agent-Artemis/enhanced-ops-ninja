"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { PublicAssessmentPayload } from "@/lib/assessment/public-config";

type Phase = "loading" | "track" | "questions" | "contact" | "results" | "error";

type SessionApi =
  | { session: null }
  | {
      session: {
        id: string;
        track: "healthcare" | "business";
        tier: "free" | "paid";
        status: string;
        answers: Record<string, string>;
        results: {
          overallScore: number;
          domainScores: Array<{ domainId: string; name: string; score: number }>;
          band: "green" | "yellow" | "orange" | "red";
        } | null;
      };
    };

type ResultsPayload = {
  overallScore: number;
  domainScores: Array<{ domainId: string; name: string; score: number }>;
  band: "green" | "yellow" | "orange" | "red";
};

function nextQuestionIndex(config: PublicAssessmentPayload, answers: Record<string, string>) {
  for (let i = 0; i < config.questions.length; i++) {
    if (!answers[config.questions[i]!.id]) return i;
  }
  return config.questions.length;
}

function barClassForScore(score: number) {
  if (score >= 75) return "bg-emerald-400";
  if (score >= 55) return "bg-yellow-300";
  if (score >= 35) return "bg-orange-400";
  return "bg-red-400";
}

function bandStyles(band: ResultsPayload["band"]) {
  switch (band) {
    case "green":
      return {
        ring: "ring-emerald-400/60",
        text: "text-emerald-300",
        label: "Strong operational health",
      };
    case "yellow":
      return {
        ring: "ring-yellow-300/60",
        text: "text-yellow-200",
        label: "Solid with improvement opportunities",
      };
    case "orange":
      return {
        ring: "ring-orange-400/60",
        text: "text-orange-300",
        label: "Elevated risk — prioritize fixes",
      };
    default:
      return {
        ring: "ring-red-400/60",
        text: "text-red-300",
        label: "Critical gaps — immediate attention",
      };
  }
}

export function AssessmentWizard() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [config, setConfig] = useState<PublicAssessmentPayload | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<ResultsPayload | null>(null);

  const hydrate = useCallback(async () => {
    setPhase("loading");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/assessment/session", { method: "GET" });
      const body = (await res.json()) as SessionApi & { error?: string };
      if (!res.ok) {
        throw new Error(body.error ?? "Unable to load session");
      }

      if (!body.session) {
        setConfig(null);
        setPhase("track");
        return;
      }

      const cfgRes = await fetch(
        `/api/assessment/config?track=${body.session.track}&tier=${body.session.tier}`,
        { method: "GET" },
      );
      const cfgJson = (await cfgRes.json()) as { config?: PublicAssessmentPayload; error?: string };
      if (!cfgRes.ok || !cfgJson.config) {
        throw new Error(cfgJson.error ?? "Unable to load assessment");
      }

      setConfig(cfgJson.config);

      if (body.session.status === "completed" && body.session.results) {
        setResults(body.session.results);
        setPhase("results");
        return;
      }

      const nextIdx = nextQuestionIndex(cfgJson.config, body.session.answers ?? {});
      if (nextIdx >= cfgJson.config.questions.length) {
        setCurrentIndex(cfgJson.config.questions.length - 1);
        setPhase("contact");
      } else {
        setCurrentIndex(nextIdx);
        setPhase("questions");
      }
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "Something went wrong");
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const currentQuestion = useMemo(() => {
    if (!config) return null;
    return config.questions[currentIndex] ?? null;
  }, [config, currentIndex]);

  const progress = useMemo(() => {
    if (!config) return { current: 0, total: 15 };
    return { current: Math.min(currentIndex + 1, config.questionCount), total: config.questionCount };
  }, [config, currentIndex]);

  const startTrack = useCallback(
    async (track: "healthcare" | "business") => {
      setSubmitting(true);
      setErrorMessage(null);
      try {
        const res = await fetch("/api/assessment/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ track, tier: "free" }),
        });
        const body = (await res.json()) as { config?: PublicAssessmentPayload; error?: string };
        if (!res.ok) {
          throw new Error(body.error ?? "Could not start assessment");
        }
        if (!body.config) {
          throw new Error("Missing assessment configuration");
        }
        setConfig(body.config);
        setCurrentIndex(0);
        setPhase("questions");
      } catch (e) {
        setErrorMessage(e instanceof Error ? e.message : "Something went wrong");
        setPhase("error");
      } finally {
        setSubmitting(false);
      }
    },
    [],
  );

  const chooseAnswer = useCallback(
    async (choiceKey: "A" | "B" | "C" | "D") => {
      if (!config || !currentQuestion) return;
      setSubmitting(true);
      setErrorMessage(null);
      try {
        const res = await fetch("/api/assessment/answer", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ questionId: currentQuestion.id, choiceKey }),
        });
        const body = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok) {
          throw new Error(body.error ?? "Could not save answer");
        }

        if (currentIndex >= config.questions.length - 1) {
          setPhase("contact");
        } else {
          setCurrentIndex((i) => i + 1);
        }
      } catch (e) {
        setErrorMessage(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setSubmitting(false);
      }
    },
    [config, currentIndex, currentQuestion],
  );

  const submitContact = useCallback(async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/assessment/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const body = (await res.json()) as ResultsPayload & { ok?: boolean; error?: string };
      if (!res.ok) {
        throw new Error(body.error ?? "Could not finalize assessment");
      }
      setResults({
        overallScore: body.overallScore,
        domainScores: body.domainScores,
        band: body.band,
      });
      setPhase("results");
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }, [email, name]);

  if (phase === "loading") {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-6 py-16 text-[rgb(255_255_255/0.55)]">
        Loading assessment…
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-6 text-red-200">
          <p className="mb-2 font-semibold">We hit a snag</p>
          <p className="text-sm text-red-100/90">{errorMessage}</p>
        </div>
        <div className="mt-8 flex flex-wrap gap-4">
          <button
            type="button"
            className="rounded-lg bg-eon-blue px-6 py-3 text-sm font-medium text-white hover:bg-[#1562b8]"
            onClick={() => void hydrate()}
          >
            Try again
          </button>
          <Link href="/" className="rounded-lg border border-[rgb(255_255_255/0.15)] px-6 py-3 text-sm text-white hover:bg-white/5">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  if (phase === "track") {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[rgb(255_255_255/0.45)]">
          Free assessment
        </p>
        <h1 className="mb-4 font-[family-name:var(--font-bebas)] text-4xl uppercase tracking-[0.04em] text-white md:text-5xl">
          Choose your track
        </h1>
        <p className="mb-10 text-sm text-[rgb(255_255_255/0.55)]">
          15 questions. About 5 minutes. Your answers roll up into domain scores and an overall
          operational health score (0–100).
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <button
            type="button"
            disabled={submitting}
            className="rounded-xl border border-eon-blue bg-eon-blue px-6 py-6 text-left text-white transition hover:bg-[#1562b8] disabled:opacity-60"
            onClick={() => void startTrack("healthcare")}
          >
            <div className="text-2xl">🏥</div>
            <div className="mt-3 font-[family-name:var(--font-bebas)] text-2xl uppercase tracking-[0.04em]">
              Healthcare
            </div>
            <div className="mt-2 text-sm text-white/80">Practice and clinic operations</div>
          </button>
          <button
            type="button"
            disabled={submitting}
            className="rounded-xl border border-[rgb(26_110_204/0.35)] bg-eon-card px-6 py-6 text-left text-white transition hover:border-eon-blue hover:bg-[rgb(26_110_204/0.08)] disabled:opacity-60"
            onClick={() => void startTrack("business")}
          >
            <div className="text-2xl">🏢</div>
            <div className="mt-3 font-[family-name:var(--font-bebas)] text-2xl uppercase tracking-[0.04em]">
              General business
            </div>
            <div className="mt-2 text-sm text-[rgb(255_255_255/0.55)]">Scaling teams and revenue engines</div>
          </button>
        </div>
        <div className="mt-10">
          <Link href="/" className="text-sm text-eon-blue hover:underline">
            ← Back to marketing site
          </Link>
        </div>
      </div>
    );
  }

  if (phase === "questions" && config && currentQuestion) {
    const pct = Math.round((progress.current / progress.total) * 100);
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link href="/" className="text-sm text-[rgb(255_255_255/0.55)] hover:text-white">
            ← Home
          </Link>
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[rgb(255_255_255/0.45)]">
            Question {progress.current} of {progress.total}
          </span>
        </div>
        <div className="mb-8 h-2 w-full overflow-hidden rounded-full bg-[rgb(255_255_255/0.08)]">
          <div className="h-full rounded-full bg-eon-blue transition-all" style={{ width: `${pct}%` }} />
        </div>
        {errorMessage ? (
          <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {errorMessage}
          </p>
        ) : null}
        <div className="rounded-2xl border border-[rgb(26_110_204/0.25)] bg-eon-card p-8">
          <p className="mb-2 text-xs uppercase tracking-[0.14em] text-eon-blue">
            {config.domains.find((d) => d.id === currentQuestion.domainId)?.name ?? "Domain"}
          </p>
          <h2 className="mb-8 text-lg font-semibold leading-relaxed text-white md:text-xl">
            {currentQuestion.prompt}
          </h2>
          <div className="grid gap-3">
            {currentQuestion.choices.map((c) => (
              <button
                key={c.key}
                type="button"
                disabled={submitting}
                className="w-full rounded-xl border border-[rgb(255_255_255/0.1)] bg-eon-black px-4 py-4 text-left text-sm text-[rgb(255_255_255/0.85)] transition hover:border-eon-blue hover:bg-[rgb(26_110_204/0.08)] disabled:opacity-60"
                onClick={() => void chooseAnswer(c.key)}
              >
                <span className="mr-3 inline-flex h-7 w-7 items-center justify-center rounded-md bg-[rgb(26_110_204/0.15)] text-xs font-bold text-eon-blue">
                  {c.key}
                </span>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (phase === "contact") {
    return (
      <div className="mx-auto max-w-xl px-6 py-16">
        <h1 className="mb-3 font-[family-name:var(--font-bebas)] text-4xl uppercase tracking-[0.04em] text-white">
          Almost there
        </h1>
        <p className="mb-8 text-sm text-[rgb(255_255_255/0.55)]">
          Share your name and work email to see your scores and domain breakdown. We use this to
          send follow-up recommendations — never sold to third parties.
        </p>
        {errorMessage ? (
          <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {errorMessage}
          </p>
        ) : null}
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.08em] text-[rgb(255_255_255/0.45)]">
              Full name
            </label>
            <input
              className="w-full rounded-lg border border-[rgb(255_255_255/0.12)] bg-[#111] px-4 py-3 text-sm text-white outline-none ring-eon-blue/30 focus:border-eon-blue focus:ring-4"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.08em] text-[rgb(255_255_255/0.45)]">
              Work email
            </label>
            <input
              className="w-full rounded-lg border border-[rgb(255_255_255/0.12)] bg-[#111] px-4 py-3 text-sm text-white outline-none ring-eon-blue/30 focus:border-eon-blue focus:ring-4"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              type="email"
            />
          </div>
          <button
            type="button"
            disabled={submitting || !name.trim() || !email.trim()}
            className="mt-4 w-full rounded-lg bg-eon-blue px-6 py-3 text-sm font-semibold text-white hover:bg-[#1562b8] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => void submitContact()}
          >
            {submitting ? "Saving…" : "Reveal my results"}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "results" && results) {
    const styles = bandStyles(results.band);
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div
          className={`mb-10 rounded-2xl border border-[rgb(255_255_255/0.08)] bg-eon-card p-8 ring-2 ${styles.ring}`}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgb(255_255_255/0.45)]">
            Overall operational health
          </p>
          <div className={`mt-4 font-[family-name:var(--font-bebas)] text-7xl leading-none ${styles.text}`}>
            {results.overallScore}
          </div>
          <p className="mt-2 text-sm text-[rgb(255_255_255/0.55)]">Score out of 100 · {styles.label}</p>
        </div>

        <h2 className="mb-4 font-[family-name:var(--font-bebas)] text-3xl uppercase tracking-[0.04em] text-white">
          Domain breakdown
        </h2>
        <div className="space-y-4">
          {results.domainScores.map((d) => (
            <div key={d.domainId} className="rounded-xl border border-[rgb(255_255_255/0.08)] bg-eon-card p-5">
              <div className="mb-2 flex items-center justify-between gap-4">
                <p className="text-sm font-medium text-white">{d.name}</p>
                <p className="text-sm font-semibold text-eon-blue">{d.score}</p>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[rgb(255_255_255/0.08)]">
                <div
                  className={`h-full rounded-full ${barClassForScore(d.score)}`}
                  style={{ width: `${d.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/"
            className="rounded-lg bg-eon-blue px-6 py-3 text-sm font-semibold text-white hover:bg-[#1562b8]"
          >
            Return to Enhanced Ops
          </Link>
          <button
            type="button"
            className="rounded-lg border border-[rgb(255_255_255/0.15)] px-6 py-3 text-sm text-white hover:bg-white/5"
            onClick={async () => {
              await fetch("/api/assessment/session", { method: "DELETE" });
              window.location.assign("/assessment");
            }}
          >
            Start a new assessment
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-16 text-[rgb(255_255_255/0.55)]">
      Unavailable state.{" "}
      <button type="button" className="text-eon-blue hover:underline" onClick={() => void hydrate()}>
        Reload
      </button>
    </div>
  );
}
