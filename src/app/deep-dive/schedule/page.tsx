import Link from "next/link";

const CAL_EMBED_SRC =
  "https://cal.com/enhancedopsninja/45-min-with-enhanced-ops-ninja";

export default function DeepDiveSchedulePage() {
  return (
    <div className="min-h-screen bg-[#000000] px-5 py-10 text-white sm:px-8 sm:py-12">
      <header className="mx-auto mb-10 max-w-3xl border-b border-[rgb(255_255_255/0.08)] pb-5">
        <Link
          href="/deep-dive/score"
          className="text-sm font-medium text-[rgb(255_255_255/0.65)] no-underline hover:text-white"
        >
          ← Back to results
        </Link>
      </header>

      <main className="mx-auto max-w-3xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#1A6ECC]">
          Deep dive
        </p>
        <h1 className="mb-4 font-[family-name:var(--font-bebas)] text-[44px] uppercase leading-none tracking-[0.04em] md:text-[52px]">
          Book Your Review Call.
        </h1>
        <p className="mb-8 max-w-2xl text-[15px] leading-relaxed text-[rgb(255_255_255/0.65)]">
          Pick a time that works for you. This is your 45-minute 1:1 with us —
          we&apos;ll walk through your full results and hand you a clear
          implementation plan.
        </p>

        <div className="mb-8 max-w-2xl rounded-xl border border-[rgb(255_255_255/0.12)] bg-[rgb(10_10_10)] px-5 py-5 sm:px-6 sm:py-6">
          <p className="text-[15px] leading-relaxed text-[rgb(255_255_255/0.85)]">
            What to expect on the call: We&apos;ll go through your assessment
            module by module, show you exactly where your biggest leverage points
            are, and give you a prioritized action plan you can start using
            immediately.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-[rgb(255_255_255/0.12)] bg-[rgb(10_10_10)]">
          <iframe
            title="Schedule a 45-minute review call with Enhanced Ops"
            src={CAL_EMBED_SRC}
            width="100%"
            height={600}
            className="w-full border-0 bg-white"
            loading="lazy"
            allow="camera; microphone; fullscreen; payment; display-capture"
          />
        </div>

        <div className="mt-8 flex justify-center">
          <Link
            href="/deep-dive/confirmation"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#1A6ECC] px-8 py-3 text-[15px] font-semibold text-white no-underline transition hover:bg-[#1562b8]"
          >
            I&apos;ve Scheduled My Call →
          </Link>
        </div>
      </main>
    </div>
  );
}
