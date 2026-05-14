import Link from "next/link";

export default function DeepDiveConfirmationPage() {
  return (
    <div className="min-h-screen bg-[#000000] px-5 py-10 text-white sm:px-8 sm:py-12">
      <main className="mx-auto max-w-xl text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#1A6ECC]">
          You&apos;re all set
        </p>
        <h1 className="mb-5 font-[family-name:var(--font-bebas)] text-[40px] uppercase leading-none tracking-[0.04em] md:text-[48px]">
          Thanks for booking
        </h1>
        <p className="mb-8 text-[15px] leading-relaxed text-[rgb(255_255_255/0.65)]">
          You&apos;ll get a calendar invite with the link for your call. Until
          then, keep an eye on your inbox for any prep notes from our team.
        </p>
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
          <Link
            href="/"
            className="inline-flex min-h-[44px] w-full max-w-[220px] items-center justify-center rounded-lg bg-[#1A6ECC] px-6 py-3 text-[15px] font-semibold text-white no-underline transition hover:bg-[#1562b8] sm:w-auto"
          >
            Home
          </Link>
          <Link
            href="/deep-dive"
            className="inline-flex min-h-[44px] w-full max-w-[220px] items-center justify-center rounded-lg border border-[rgb(255_255_255/0.2)] px-6 py-3 text-[15px] font-semibold text-white no-underline transition hover:border-white hover:bg-[rgb(255_255_255/0.06)] sm:w-auto"
          >
            Deep dive
          </Link>
        </div>
      </main>
    </div>
  );
}
