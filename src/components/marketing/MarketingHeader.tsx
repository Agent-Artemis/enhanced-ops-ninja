"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

const DOJO_URL = "https://dojo.enhancedops.ninja";
const MISSION_URL = "https://mission.enhancedops.ninja";

function PortalChooserModal({ onClose }: { onClose: () => void }) {
  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
    >
      {/* Backdrop click closes */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#1A6ECC]">
            Enter the Mission
          </p>
          <h2 className="font-[family-name:var(--font-bebas)] text-[40px] uppercase leading-none tracking-[0.04em] text-white md:text-[52px]">
            Who are you?
          </h2>
        </div>

        {/* Choice cards */}
        <div className="grid grid-cols-2 gap-4">
          {/* Ninja card */}
          <a
            href={DOJO_URL}
            className="group flex flex-col items-center gap-4 rounded-2xl border border-[rgb(26_110_204/0.3)] bg-[rgb(10_10_10)] p-8 no-underline transition hover:border-[#1A6ECC] hover:bg-[rgb(26_110_204/0.08)]"
          >
            <Image
              src="/Ninja_Transparent.png"
              alt="EON Ninja"
              width={80}
              height={80}
              className="h-20 w-auto"
            />
            <div className="text-center">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1A6ECC]">
                EON Team
              </div>
              <div className="font-[family-name:var(--font-bebas)] text-2xl uppercase tracking-[0.04em] text-white">
                I&apos;m a Ninja
              </div>
              <div className="mt-2 text-[13px] text-[rgb(255_255_255/0.5)]">
                Go to Ninja Dojo
              </div>
            </div>
          </a>

          {/* Client card */}
          <a
            href={MISSION_URL}
            className="group flex flex-col items-center gap-4 rounded-2xl border border-[rgb(26_110_204/0.3)] bg-[rgb(10_10_10)] p-8 no-underline transition hover:border-[#1A6ECC] hover:bg-[rgb(26_110_204/0.08)]"
          >
            <Image
              src="/Ninja_Squatting-transparent.png"
              alt="Client"
              width={80}
              height={80}
              className="h-20 w-auto"
            />
            <div className="text-center">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1A6ECC]">
                Client
              </div>
              <div className="font-[family-name:var(--font-bebas)] text-2xl uppercase tracking-[0.04em] text-white">
                I&apos;m a Client
              </div>
              <div className="mt-2 text-[13px] text-[rgb(255_255_255/0.5)]">
                Go to Secret Mission
              </div>
            </div>
          </a>
        </div>

        <p className="mt-6 text-center text-[13px] text-[rgb(255_255_255/0.3)]">
          Press ESC or click outside to close
        </p>
      </div>
    </div>
  );
}

export function MarketingHeader() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-[1000] border-b border-[rgb(26_110_204/0.3)] bg-eon-black px-6 py-4">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between">
          <Link href="/" className="flex items-center gap-2 no-underline">
            <Image
              src="/ninja-logo.png"
              alt="Enhanced Ops"
              width={300}
              height={80}
              className="h-auto max-h-14 w-auto max-w-[220px] object-contain md:max-w-[300px]"
              priority
            />
          </Link>

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#1A6ECC] px-5 py-2.5 text-[15px] font-semibold text-white transition hover:bg-[#1562b8]"
          >
            <span className="hidden sm:inline">Enter the Mission</span>
            <span className="sm:hidden">Enter</span>
          </button>
        </div>
      </header>

      {modalOpen && <PortalChooserModal onClose={() => setModalOpen(false)} />}
    </>
  );
}
