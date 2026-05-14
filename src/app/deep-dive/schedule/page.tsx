import Link from "next/link";

function calEmbedUrl(bookingUrl: string): string {
  try {
    const u = new URL(bookingUrl);
    if (!u.searchParams.has("embed")) u.searchParams.set("embed", "true");
    return u.toString();
  } catch {
    return bookingUrl;
  }
}

export default function DeepDiveSchedulePage() {
  const raw = process.env.CAL_COM_BOOKING_URL?.trim();
  const bookingUrl = raw && raw.length > 0 ? raw : null;

  return (
    <div className="min-h-screen bg-[#000000] px-6 py-12 text-white">
      <header className="mx-auto mb-10 max-w-3xl border-b border-[rgb(255_255_255/0.08)] pb-5">
        <Link
          href="/deep-dive/score"
          className="text-sm font-medium text-[rgb(255_255_255/0.65)] no-underline hover:text-white"
        >
          ← Back to results
        </Link>
      </header>

      <main className="mx-auto max-w-3xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#1A6ECC]">Deep dive</p>
        <h1 className="mb-4 font-[family-name:var(--font-bebas)] text-[44px] uppercase leading-none tracking-[0.04em] md:text-[52px]">
          Schedule your <span className="text-[#1A6ECC]">1:1 review</span>
        </h1>
        <p className="mb-8 max-w-xl text-[15px] leading-relaxed text-[rgb(255_255_255/0.65)]">
          Pick a time that works for you. If the calendar does not load, use the link below.
        </p>

        {bookingUrl ? (
          <div className="overflow-hidden rounded-xl border border-[rgb(255_255_255/0.12)] bg-[rgb(10_10_10)]">
            <iframe
              title="Book a review call"
              src={calEmbedUrl(bookingUrl)}
              className="h-[720px] w-full border-0 bg-white"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="rounded-xl border border-[rgb(255_255_255/0.12)] bg-[rgb(10_10_10)] px-6 py-10 text-center">
            <p className="mb-6 text-[15px] leading-relaxed text-[rgb(255_255_255/0.65)]">
              Online scheduling is not configured in this environment yet. When you complete your assessment, your
              results email includes a booking link, or reach out through the main deep dive page.
            </p>
            <Link
              href="/deep-dive"
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#1A6ECC] px-6 py-3 text-[15px] font-semibold text-white no-underline transition hover:bg-[#1562b8]"
            >
              Go to deep dive
            </Link>
          </div>
        )}

        {bookingUrl ? (
          <p className="mt-6 text-center text-sm text-[rgb(255_255_255/0.5)]">
            <a href={bookingUrl} className="text-[#1A6ECC] underline-offset-4 hover:underline" target="_blank" rel="noreferrer">
              Open booking page in a new tab
            </a>
          </p>
        ) : null}
      </main>
    </div>
  );
}
