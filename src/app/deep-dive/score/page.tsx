"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { DEEP_DIVE_LS, readLocalStorage } from "@/lib/deep-dive/assessment-storage";

function parseModuleScores(raw: string | null): Record<string, number> | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

export default function DeepDiveScorePage() {
  const [hydrated, setHydrated] = useState(false);
  const [overall, setOverall] = useState<number | null>(null);
  const [modules, setModules] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    const rawOverall = readLocalStorage(DEEP_DIVE_LS.overallScore);
    const n = rawOverall != null ? Number(rawOverall) : NaN;
    setOverall(Number.isFinite(n) ? Math.round(n) : null);
    setModules(parseModuleScores(readLocalStorage(DEEP_DIVE_LS.moduleScores)));
    setHydrated(true);
  }, []);

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
            Complete the deep dive assessment first, or open this page on the same device and browser
            you used when you finished.
          </p>
          <div className="flex flex-col items-center gap-4">
            <Link
              href="/deep-dive"
              className="inline-flex rounded-lg bg-[#1A6ECC] px-6 py-3 text-[15px] font-semibold text-white no-underline transition hover:bg-[#1562b8]"
            >
              Deep dive checkout
            </Link>
            <Link href="/" className="text-sm text-[#1A6ECC] underline-offset-4 hover:underline">
              Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const rows = Object.entries(modules).sort(([a], [b]) => a.localeCompare(b));

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
        <h1 className="mb-10 text-center font-[family-name:var(--font-bebas)] text-[44px] uppercase leading-none tracking-[0.04em] md:text-[52px]">
          Your <span className="text-[#1A6ECC]">scores</span>
        </h1>

        <div className="mb-10 rounded-xl border border-[rgb(26_110_204/0.35)] bg-[rgb(26_110_204/0.12)] px-6 py-8 text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(255_255_255/0.55)]">
            Overall operational score
          </p>
          <p className="font-[family-name:var(--font-bebas)] text-7xl leading-none text-white">
            {overall}
            <span className="text-3xl text-[rgb(255_255_255/0.45)]">/100</span>
          </p>
          <p className="mt-4 text-sm text-[rgb(255_255_255/0.55)]">
            Placeholder view — detailed PDF and review call scheduling arrive by email after submission.
          </p>
        </div>

        <div className="rounded-xl border border-[rgb(255_255_255/0.1)] bg-[rgb(10_10_10)] p-6">
          <h2 className="mb-4 font-[family-name:var(--font-bebas)] text-2xl uppercase tracking-[0.04em] text-white">
            Module scores
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[15px]">
              <thead>
                <tr className="border-b border-[rgb(255_255_255/0.12)] text-xs font-semibold uppercase tracking-[0.08em] text-[rgb(255_255_255/0.45)]">
                  <th className="py-3 pr-4">Module</th>
                  <th className="py-3 text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([key, score]) => (
                  <tr key={key} className="border-b border-[rgb(255_255_255/0.06)] last:border-0">
                    <td className="py-3 pr-4 text-[rgb(255_255_255/0.85)]">{key.replace(/^module-/, "Module ")}</td>
                    <td className="py-3 text-right font-semibold text-[#1A6ECC]">{Math.round(score)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
