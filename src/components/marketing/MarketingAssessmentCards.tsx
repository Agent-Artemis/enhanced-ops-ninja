import Link from "next/link";

export function MarketingAssessmentCards(props: { onBookDeepDive: () => void }) {
  return (
    <section className="bg-eon-off-black px-6 py-16" id="assessment">
      <div className="mx-auto mb-12 max-w-[1000px] text-center">
        <h2 className="font-[family-name:var(--font-bebas)] text-[42px] uppercase tracking-[0.04em]">
          LOCK IN YOUR <span className="text-eon-blue">ASSESSMENT</span>
        </h2>
      </div>
      <div className="mx-auto grid max-w-[1000px] gap-8 md:grid-cols-2">
        <div className="flex flex-col rounded-xl border border-[rgb(26_110_204/0.3)] bg-eon-card p-8">
          <span className="mb-4 inline-block w-fit rounded-md border border-[rgb(26_110_204/0.3)] bg-[rgb(26_110_204/0.2)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.04em] text-eon-blue">
            START HERE — FREE
          </span>
          <h3 className="mb-2 font-[family-name:var(--font-bebas)] text-2xl uppercase tracking-[0.03em]">
            Operations Quick Scan
          </h3>
          <div className="mb-2 font-[family-name:var(--font-bebas)] text-[42px] leading-none text-eon-blue">
            $0
          </div>
          <p className="mb-6 text-[13px] leading-relaxed text-[rgb(255_255_255/0.55)]">
            A focused 15-question assessment that identifies automation opportunities across your
            operation. Reviewed personally by our team.
          </p>
          <ul className="mb-6 list-none space-y-2 text-[13px] text-[rgb(255_255_255/0.55)]">
            <li>
              <span className="font-semibold text-eon-blue">✓ </span>
              Industry-specific questions (healthcare or business)
            </li>
            <li>
              <span className="font-semibold text-eon-blue">✓ </span>
              Domain scores plus an overall operational health score (0–100)
            </li>
            <li>
              <span className="font-semibold text-eon-blue">✓ </span>
              Branded PDF report after you complete a short contact step
            </li>
            <li>
              <span className="font-semibold text-eon-blue">✓ </span>
              No credit card. No commitment.
            </li>
          </ul>
          <Link
            href="/assessment"
            className="mt-auto flex w-full cursor-pointer items-center justify-center rounded-lg border-none bg-eon-blue px-7 py-3.5 text-center text-[15px] font-medium text-white no-underline transition hover:bg-[#1562b8]"
          >
            Take the Free Assessment →
          </Link>
        </div>

        <div className="flex flex-col rounded-xl border border-[rgb(26_110_204/0.3)] bg-eon-card p-8">
          <span className="mb-4 inline-block w-fit rounded-md border border-[rgb(26_110_204/0.3)] bg-[rgb(26_110_204/0.2)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.04em] text-eon-blue">
            MOST COMPREHENSIVE
          </span>
          <h3 className="mb-2 font-[family-name:var(--font-bebas)] text-2xl uppercase tracking-[0.03em]">
            In-Depth Operational Assessment
          </h3>
          <div className="mb-2 font-[family-name:var(--font-bebas)] text-[42px] leading-none text-eon-blue">
            $2,500
          </div>
          <p className="mb-6 text-[13px] leading-relaxed text-[rgb(255_255_255/0.55)]">
            A comprehensive 48-question operational assessment gated behind Stripe checkout. You get
            domain rollups, an overall score, and a branded PDF suitable for leadership review.
          </p>
          <ul className="mb-6 list-none space-y-2 text-[13px] text-[rgb(255_255_255/0.55)]">
            <li>
              <span className="font-semibold text-eon-blue">✓ </span>
              Deeper coverage across six operational domains
            </li>
            <li>
              <span className="font-semibold text-eon-blue">✓ </span>
              Paid access unlocked after successful payment
            </li>
            <li>
              <span className="font-semibold text-eon-blue">✓ </span>
              Same scoring model and PDF report pipeline as the free tier
            </li>
            <li>
              <span className="font-semibold text-eon-blue">✓ </span>
              Results persisted to Supabase for continuity and follow-up
            </li>
          </ul>
          <button
            type="button"
            className="mt-auto w-full cursor-pointer rounded-lg border-none bg-eon-blue px-7 py-3.5 text-center text-[15px] font-medium text-white transition hover:bg-[#1562b8]"
            onClick={props.onBookDeepDive}
          >
            Purchase In-Depth Assessment →
          </button>
        </div>
      </div>
    </section>
  );
}
