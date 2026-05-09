"use client";

import { useCallback, useEffect, useId, useState } from "react";

export function AssessmentModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const titleId = useId();
  const [step, setStep] = useState<"pick" | "soon">("pick");

  useEffect(() => {
    if (!open) setStep("pick");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const onOverlayPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  if (!open) return null;

  function advanceFromIndustryPick() {
    setStep("soon");
  }

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/85 px-4"
      onPointerDown={onOverlayPointerDown}
      role="presentation"
    >
      <div
        className="relative max-h-[85vh] w-full max-w-[580px] overflow-y-auto rounded-2xl border border-[rgb(26_110_204/0.3)] bg-[#1a1a1a]"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <button
          type="button"
          className="absolute right-6 top-6 text-3xl leading-none text-white hover:text-eon-blue"
          onClick={onClose}
          aria-label="Close assessment dialog"
        >
          ×
        </button>
        <div className="flex items-center gap-3 border-b border-[rgb(26_110_204/0.3)] px-8 py-8 font-[family-name:var(--font-bebas)] text-[22px] tracking-[0.04em] text-white">
          <span className="text-2xl" aria-hidden>
            ⚔
          </span>
          <span id={titleId}>YOUR FREE ASSESSMENT</span>
        </div>
        <div className="px-8 py-8">
          {step === "pick" ? (
            <>
              <p className="mb-8 text-[rgb(255_255_255/0.55)]">
                Select your industry to begin:
              </p>
              <button
                type="button"
                className="mb-4 w-full rounded-lg bg-eon-blue px-7 py-3.5 font-medium text-white transition hover:bg-[#1562b8]"
                onClick={() => advanceFromIndustryPick()}
              >
                🏥 Healthcare
              </button>
              <button
                type="button"
                className="w-full rounded-lg border border-eon-blue bg-transparent px-7 py-3.5 font-medium text-eon-blue transition hover:bg-[rgb(26_110_204/0.1)]"
                onClick={() => advanceFromIndustryPick()}
              >
                🏢 General Business
              </button>
            </>
          ) : (
            <>
              <p className="mb-4 text-[rgb(255_255_255/0.55)]">
                The guided assessment flow is being wired to your new Next.js routes, Supabase
                sessions, and the lead capture gate (name/email after completion, before scores).
              </p>
              <p className="mb-8 text-sm text-[rgb(255_255_255/0.55)]">
                For now, close this dialog and continue exploring the site.
              </p>
              <button
                type="button"
                className="w-full rounded-lg bg-eon-blue px-7 py-3.5 font-medium text-white transition hover:bg-[#1562b8]"
                onClick={onClose}
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
