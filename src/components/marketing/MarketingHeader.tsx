"use client";

import Image from "next/image";
import Link from "next/link";

export function MarketingHeader() {
  return (
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

        <a
          href="https://mission.enhancedops.ninja"
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#1A6ECC] px-5 py-2.5 text-[15px] font-semibold text-white no-underline transition hover:bg-[#1562b8]"
        >
          <span className="hidden sm:inline">Enter the Mission</span>
          <span className="sm:hidden">Enter</span>
        </a>
      </div>
    </header>
  );
}
