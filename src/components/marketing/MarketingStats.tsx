export function MarketingStats() {
  const leverageItemClass =
    "font-[family-name:var(--font-bebas)] text-4xl font-bold uppercase leading-tight text-white md:text-5xl";

  return (
    <section className="flex flex-row flex-wrap items-center justify-evenly gap-y-8 bg-eon-blue px-6 py-12 md:flex-nowrap md:py-14">
      <div className="flex flex-col items-center text-center">
        <div className="mb-2 text-xs uppercase tracking-[0.08em] text-white opacity-85">
          WE FOCUS ON
        </div>
        <div className="font-[family-name:var(--font-bebas)] text-6xl font-bold uppercase leading-none text-white md:text-7xl">
          LEVERAGE
        </div>
      </div>

      <div className="flex flex-col items-center gap-3 text-center">
        <div className={leverageItemClass}>TIME</div>
        <div className={leverageItemClass}>FINANCES</div>
      </div>

      <div className="flex flex-col items-center gap-3 text-center">
        <div className={leverageItemClass}>STAFFING</div>
        <div className={leverageItemClass}>PATIENT & CLIENT CARE</div>
      </div>
    </section>
  );
}
