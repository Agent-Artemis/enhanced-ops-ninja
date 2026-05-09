export function MarketingHero(props: {
  onOpenAssessment: () => void;
  onBookCall: () => void;
}) {
  return (
    <section className="border-b border-[rgb(26_110_204/0.3)] bg-eon-black px-6 pb-12 pt-8">
      <div className="mx-auto grid max-w-[1200px] items-start gap-12 md:grid-cols-2">
        <div className="z-[2] mt-0 md:mt-44">
          <p className="mb-6 text-[18px] font-semibold uppercase tracking-[0.15em] text-[rgb(255_255_255/0.55)]">
            Enhanced operations and assessments
          </p>
          <p className="mb-6 text-sm leading-relaxed text-[rgb(255_255_255/0.55)]">
            Whether you run a medical practice or a growing business — we deploy AI automation that
            eliminates manual work, recovers lost revenue, and scales your operations without hiring
            more staff.
          </p>
          <div className="mb-4 flex flex-wrap gap-3">
            <button
              type="button"
              className="cursor-pointer rounded-lg border-none bg-eon-blue px-7 py-3.5 text-[15px] font-medium text-white transition hover:bg-[#1562b8]"
              onClick={props.onOpenAssessment}
            >
              Get My Free Assessment →
            </button>
            <button
              type="button"
              className="cursor-pointer rounded-lg border border-eon-blue bg-transparent px-7 py-3.5 text-[15px] font-medium text-eon-blue transition hover:bg-[rgb(26_110_204/0.1)]"
              onClick={props.onBookCall}
            >
              Book a Strategy Call
            </button>
          </div>
          <p className="text-xs text-[rgb(255_255_255/0.4)]">
            🔒 HIPAA-compliant infrastructure | No obligation | Results in 24 hours
          </p>
        </div>
        <div className="z-[2]">
          <p className="mb-12 font-[family-name:var(--font-bebas)] text-[32px] uppercase leading-tight tracking-[0.04em] text-white">
            Cut Chaos. Get Results.
            <br />
            <span className="text-eon-blue">... Like a Ninja.</span>
          </p>
          <h1 className="mb-8 font-[family-name:var(--font-bebas)] text-[42px] uppercase leading-[1.15] tracking-[0.02em] md:text-[48px]">
            <span className="text-white">STOP DOING IT</span>
            <br />
            <span className="text-eon-blue">THE HARD WAY</span>
          </h1>
          <div className="mb-0 flex aspect-video flex-col items-center justify-center rounded-[10px] border border-[rgb(26_110_204/0.3)] bg-[rgb(26_110_204/0.08)] p-8 text-center">
            <div className="mb-2 text-5xl text-eon-blue">▶</div>
            <p className="text-[13px] text-[rgb(255_255_255/0.55)]">
              Watch: How Enhanced Ops Works (3 min)
            </p>
            <p className="mt-2 text-[11px] text-[rgb(255_255_255/0.4)]">
              [VSL VIDEO PLACEHOLDER — to be replaced]
            </p>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-10 flex max-w-[1200px] justify-center md:hidden">
        <button
          type="button"
          className="cursor-pointer rounded-md border border-eon-blue bg-transparent px-5 py-2.5 text-[13px] font-medium text-eon-blue"
          onClick={props.onOpenAssessment}
        >
          Take Free Assessment
        </button>
      </div>
    </section>
  );
}
