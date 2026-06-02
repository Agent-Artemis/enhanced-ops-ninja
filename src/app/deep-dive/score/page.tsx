"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { getDeepDiveModuleTitleForScoreKey } from "@/lib/deep-dive/assessment-data";
import type { BusinessTrack } from "@/lib/deep-dive/pricing";
import {
  DEEP_DIVE_LS,
  parseBusinessType,
  readLocalStorage,
  type StoredBusinessType,
  writeLocalStorage,
} from "@/lib/deep-dive/assessment-storage";

const NINJA_REVIEW_COPY =
  "Our ninjas will review your answers and map what a focused implementation plan could look like for your team. On a short call we will walk through the highlights, answer questions, and outline practical next steps.";

type TierInfo = { label: string; color: string; ringColor: string };

function tierFromScore(overall: number): TierInfo {
  if (overall >= 80) {
    return {
      label: "Operationally Strong",
      color: "#22c55e",
      ringColor: "#22c55e",
    };
  }
  if (overall >= 60) {
    return {
      label: "Functional — Room to Grow",
      color: "#1A6ECC",
      ringColor: "#1A6ECC",
    };
  }
  if (overall >= 40) {
    return {
      label: "Needs Attention",
      color: "#eab308",
      ringColor: "#eab308",
    };
  }
  return {
    label: "Significant Gaps Identified",
    color: "#ef4444",
    ringColor: "#ef4444",
  };
}

function parseModuleScores(raw: string | null): Record<string, number> | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

function moduleSortKey(key: string): number {
  const m = /^module-(\d+)$/.exec(key);
  if (!m) return 999;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : 999;
}

function ScoreRing(props: { value: number; strokeColor: string }) {
  const size = 200;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, props.value)) / 100;
  const dash = c * pct;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" aria-hidden>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgb(255 255 255 / 0.1)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={props.strokeColor}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c}`}
        transform={`rotate(-90 ${String(size / 2)} ${String(size / 2)})`}
      />
    </svg>
  );
}

function barColorFromScore(score: number): string {
  if (score >= 75) return "#22c55e"; // green  — Operationally Strong
  if (score >= 60) return "#eab308"; // yellow — Functional, Room to Grow
  if (score >= 40) return "#f97316"; // orange — Needs Attention
  return "#ef4444";                  // red    — Significant Gaps
}

function ModuleBar(props: { label: string; score: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(props.score)));
  const color = barColorFromScore(pct);
  return (
    <div className="mb-5 last:mb-0">
      <div className="mb-2 flex items-start justify-between gap-3 text-[14px] leading-snug">
        <span className="text-[rgb(255_255_255/0.88)]">{props.label}</span>
        <span className="shrink-0 font-semibold tabular-nums" style={{ color }}>{pct}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-[rgb(255_255_255/0.08)]">
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export default function DeepDiveScorePage() {
  const [hydrated, setHydrated] = useState(false);
  const [overall, setOverall] = useState<number | null>(null);
  const [modules, setModules] = useState<Record<string, number> | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [track, setTrack] = useState<StoredBusinessType | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const osParam = params.get("os");
    const msParam = params.get("ms");

    const rawOverall = osParam ? decodeURIComponent(osParam) : readLocalStorage(DEEP_DIVE_LS.overallScore);
    const n = rawOverall != null ? Number(rawOverall) : NaN;
    const resolvedOverall = Number.isFinite(n) ? Math.round(n) : null;
    if (resolvedOverall !== null) writeLocalStorage(DEEP_DIVE_LS.overallScore, String(resolvedOverall));
    setOverall(resolvedOverall);

    const rawModules = msParam ? decodeURIComponent(msParam) : readLocalStorage(DEEP_DIVE_LS.moduleScores);
    const resolvedModules = parseModuleScores(rawModules);
    if (resolvedModules) writeLocalStorage(DEEP_DIVE_LS.moduleScores, JSON.stringify(resolvedModules));
    setModules(resolvedModules);

    const fn = readLocalStorage(DEEP_DIVE_LS.firstName);
    setFirstName(fn != null && fn.trim().length > 0 ? fn.trim() : null);
    setTrack(parseBusinessType(readLocalStorage(DEEP_DIVE_LS.businessType)));
    setHydrated(true);
  }, []);

  const effectiveTrack: BusinessTrack = track ?? "business";

  const moduleRows = useMemo(() => {
    if (!modules) return [];
    return Object.entries(modules)
      .sort((a, b) => moduleSortKey(a[0]) - moduleSortKey(b[0]))
      .map(([key, score]) => ({
        key,
        score,
        label: getDeepDiveModuleTitleForScoreKey(key, effectiveTrack),
      }));
  }, [modules, effectiveTrack]);

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-[#000000] px-6 py-16 text-[rgb(255_255_255/0.7)]">
        <p className="mx-auto max-w-lg text-center text-sm">Loading…</p>
      </div>
    );
  }

  if (overall === null || modules === null) {
    return (
      <div className="min-h-screen bg-[#000000] px-6 py-16 text-white">
        <div className="mx-auto max-w-lg text-center">
          <h1 className="mb-4 font-[family-name:var(--font-bebas)] text-4xl uppercase tracking-[0.04em] text-[#1A6ECC]">
            Results not found
          </h1>
          <p className="mb-8 text-[15px] leading-relaxed text-[rgb(255_255_255/0.65)]">
            Complete the deep dive assessment first, or open this page on the same device and browser you used when
            you finished.
          </p>
          <div className="flex flex-col items-center gap-4">
            <Link
              href="/deep-dive"
              className="inline-flex min-h-[44px] w-full max-w-xs items-center justify-center rounded-lg bg-[#1A6ECC] px-6 py-3 text-[15px] font-semibold text-white no-underline transition hover:bg-[#1562b8] sm:w-auto"
            >
              Deep dive overview
            </Link>
            <Link
              href="/deep-dive/assessment"
              className="inline-flex min-h-[44px] w-full max-w-xs items-center justify-center rounded-lg border border-[rgb(26_110_204/0.45)] px-6 py-3 text-[15px] font-semibold text-[#1A6ECC] no-underline transition hover:bg-[rgb(26_110_204/0.12)] sm:w-auto"
            >
              Take the assessment
            </Link>
            <Link href="/" className="text-sm text-[#1A6ECC] underline-offset-4 hover:underline">
              Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const tier = tierFromScore(overall);

  return (
    <div className="min-h-screen bg-[#000000] text-white">
      <header className="border-b border-[rgb(255_255_255/0.08)] px-6 py-5">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="text-sm font-medium text-[rgb(255_255_255/0.65)] no-underline hover:text-white">
            ← Enhanced Ops × Ninja
          </Link>
          <Link href="/deep-dive" className="text-sm font-medium text-[#1A6ECC] no-underline hover:underline">
            Deep dive
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.14em] text-[#1A6ECC]">
          Deep dive results
        </p>
        <h1 className="mb-3 text-center font-[family-name:var(--font-bebas)] text-[44px] uppercase leading-none tracking-[0.04em] md:text-[52px]">
          Your <span className="text-[#1A6ECC]">scores</span>
        </h1>
        {firstName ? (
          <p className="mb-10 text-center text-[15px] text-[rgb(255_255_255/0.6)]">Hi {firstName} — here is how you landed.</p>
        ) : (
          <p className="mb-10 text-center text-[15px] text-[rgb(255_255_255/0.6)]">Here is how you landed.</p>
        )}

        <div className="mb-10 flex flex-col items-center rounded-xl border border-[rgb(255_255_255/0.1)] bg-[rgb(10_10_10)] px-6 py-10">
          <div className="relative mb-6 flex items-center justify-center">
            <ScoreRing value={overall} strokeColor={tier.ringColor} />
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="font-[family-name:var(--font-bebas)] text-5xl leading-none text-white">{overall}</span>
              <span className="mt-1 text-sm font-medium text-[rgb(255_255_255/0.45)]">/100</span>
            </div>
          </div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(255_255_255/0.45)]">
            Overall operational score
          </p>
          <p className="text-lg font-semibold" style={{ color: tier.color }}>
            {tier.label}
          </p>
        </div>

        <div className="mb-10 rounded-xl border border-[rgb(255_255_255/0.1)] bg-[rgb(10_10_10)] p-6">
          <h2 className="mb-6 font-[family-name:var(--font-bebas)] text-2xl uppercase tracking-[0.04em] text-white">
            Module breakdown
          </h2>
          {moduleRows.map((row) => (
            <ModuleBar key={row.key} label={row.label} score={row.score} />
          ))}
        </div>

        <div className="mb-8 rounded-xl border border-[rgb(26_110_204/0.35)] bg-[rgb(26_110_204/0.08)] px-6 py-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#1A6ECC]">Ninja review</p>
          <p className="text-[15px] leading-relaxed text-[rgb(255_255_255/0.82)]">{NINJA_REVIEW_COPY}</p>
        </div>

        <p className="mb-8 text-center text-sm text-[rgb(255_255_255/0.55)]">
          A summary of your score has been sent to your email.
        </p>

        <div className="flex justify-center">
          <Link
            href="/deep-dive/schedule"
            className="inline-flex min-h-[48px] items-center justify-center rounded-lg bg-[#1A6ECC] px-8 py-3 text-[15px] font-semibold text-white no-underline transition hover:bg-[#1562b8]"
          >
            Schedule My 1:1 Review Call →
          </Link>
        </div>
      </main>
    </div>
  );
}
