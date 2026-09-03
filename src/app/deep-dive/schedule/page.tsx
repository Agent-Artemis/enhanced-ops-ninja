'use client';

import Link from 'next/link';
import Script from 'next/script';

const CAL_LINK = '/book/briefing';

function initCal() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Cal = (window as any).Cal;
  if (!Cal) return;
  Cal('init', 'reviewCall', { origin: 'https://cal.com' });
  Cal('reviewCall', 'inline', {
    elementOrSelector: '#cal-review-call',
    calLink: CAL_LINK,
    config: { layout: 'month_view' },
  });
  Cal('reviewCall', 'ui', {
    styles: { branding: { brandColor: '#1A6ECC' } },
    hideEventTypeDetails: false,
    layout: 'month_view',
  });
}

export default function SchedulePage() {
  return (
    <>
      {/* Cal.com requires their embed script — raw iframes are blocked by X-Frame-Options */}
      <Script
        src="https://app.cal.com/embed/embed.js"
        strategy="afterInteractive"
        onLoad={initCal}
      />

      <div className="min-h-screen bg-[#000000] text-white">
        <header className="border-b border-[rgb(255_255_255/0.08)] px-6 py-5">
          <div className="mx-auto flex max-w-3xl items-center justify-between">
            <Link href="/deep-dive/score" className="text-sm font-medium text-[rgb(255_255_255/0.65)] no-underline hover:text-white">
              ← Back to results
            </Link>
            <Link href="/" className="text-sm font-medium text-[#1A6ECC] no-underline hover:underline">
              Enhanced Ops × Ninja
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-6 py-12">
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.14em] text-[#1A6ECC]">
            Next step
          </p>
          <h1 className="mb-3 text-center font-[family-name:var(--font-bebas)] text-[44px] uppercase leading-none tracking-[0.04em] md:text-[52px]">
            Book Your <span className="text-[#1A6ECC]">Review Call</span>
          </h1>
          <p className="mb-10 text-center text-[15px] leading-relaxed text-[rgb(255_255_255/0.6)]">
            45 minutes with us — we&apos;ll walk through your results module by module and hand you a prioritised action plan you can start using immediately.
          </p>

          <div className="mb-8 rounded-xl border border-[rgb(26_110_204/0.25)] bg-[rgb(26_110_204/0.06)] px-6 py-5 text-[14px] leading-relaxed text-[rgb(255_255_255/0.7)]">
            <span className="font-semibold text-white">What to expect:</span>{' '}
            We&apos;ll go through each module score, identify your biggest leverage points, and give you a clear implementation plan you can act on immediately.
          </div>

          {/* Cal.com inline embed mount point */}
          <div
            id="cal-review-call"
            style={{ minHeight: '600px', borderRadius: '12px', overflow: 'hidden' }}
          />
        </main>
      </div>
    </>
  );
}
