export function MarketingStats() {
  return (
    <section className="grid gap-8 bg-eon-blue px-6 py-8 md:grid-cols-3 md:items-center md:gap-8">
      <div>
        <div className="mb-2 text-xs uppercase tracking-[0.08em] text-white opacity-85">
          WE FOCUS ON
        </div>
        <div className="font-[family-name:var(--font-bebas)] text-5xl leading-none text-white">
          LEVERAGE
        </div>
      </div>
      <div className="grid grid-cols-2 gap-8 text-center">
        <div>
          <div className="mb-2 font-[family-name:var(--font-bebas)] text-5xl font-bold leading-none text-white">
            1
          </div>
          <div className="text-xs uppercase tracking-[0.08em] text-white opacity-85">TIME</div>
        </div>
        <div>
          <div className="mb-2 font-[family-name:var(--font-bebas)] text-5xl font-bold leading-none text-white">
            2
          </div>
          <div className="text-xs uppercase tracking-[0.08em] text-white opacity-85">FINANCES</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-8 text-center">
        <div>
          <div className="mb-2 font-[family-name:var(--font-bebas)] text-5xl font-bold leading-none text-white">
            3
          </div>
          <div className="text-xs uppercase tracking-[0.08em] text-white opacity-85">STAFFING</div>
        </div>
        <div>
          <div className="mb-2 font-[family-name:var(--font-bebas)] text-5xl font-bold leading-none text-white">
            4
          </div>
          <div className="text-xs uppercase tracking-[0.08em] text-white opacity-85">
            PATIENT & CLIENT CARE
          </div>
        </div>
      </div>
    </section>
  );
}
