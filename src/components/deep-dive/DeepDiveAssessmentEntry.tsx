"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const STORAGE_KEY = "deepDiveAssessmentId";

export function DeepDiveAssessmentEntry() {
  const searchParams = useSearchParams();
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const fromQuery = searchParams.get("deepDiveAssessmentId");
    if (fromQuery) {
      try {
        localStorage.setItem(STORAGE_KEY, fromQuery);
      } catch {
        // ignore quota / private mode
      }
    }
    try {
      setAssessmentId(localStorage.getItem(STORAGE_KEY));
    } catch {
      setAssessmentId(null);
    }
    setHydrated(true);
  }, [searchParams]);

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-black px-6 py-16 text-[rgb(255_255_255/0.7)]">
        <p className="mx-auto max-w-lg text-center text-sm">Loading…</p>
      </div>
    );
  }

  if (!assessmentId) {
    return (
      <div className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-lg text-center">
          <h1 className="mb-4 font-[family-name:var(--font-bebas)] text-4xl uppercase tracking-[0.04em] text-[#1A6ECC]">
            Deep dive assessment
          </h1>
          <p className="mb-8 text-[15px] leading-relaxed text-[rgb(255_255_255/0.65)]">
            We could not find your paid session. Complete checkout first, or return to the deep dive
            flow to start again.
          </p>
          <Link
            href="/deep-dive"
            className="inline-flex rounded-lg bg-[#1A6ECC] px-6 py-3 text-[15px] font-medium text-white no-underline transition hover:bg-[#1562b8]"
          >
            Back to deep dive checkout
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-2xl">
        <p className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.12em] text-[#1A6ECC]">
          Enhanced Ops × Ninja
        </p>
        <h1 className="mb-6 text-center font-[family-name:var(--font-bebas)] text-4xl uppercase tracking-[0.04em] md:text-5xl">
          You&apos;re in
        </h1>
        <p className="mb-4 text-center text-[15px] leading-relaxed text-[rgb(255_255_255/0.65)]">
          Payment received. Your assessment reference is saved on this device.
        </p>
        <p className="mb-10 rounded-lg border border-[rgb(26_110_204/0.35)] bg-[rgb(26_110_204/0.12)] px-4 py-3 text-center font-mono text-sm text-white">
          {assessmentId}
        </p>
        <p className="text-center text-[15px] leading-relaxed text-[rgb(255_255_255/0.65)]">
          Assessment questionnaire coming next.
        </p>
        <div className="mt-10 text-center">
          <Link href="/" className="text-[#1A6ECC] underline-offset-4 hover:underline">
            Return home
          </Link>
        </div>
      </div>
    </div>
  );
}
