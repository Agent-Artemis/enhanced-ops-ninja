export function MarketingStats() {
  return (
    <section className="grid gap-8 bg-eon-blue px-6 py-8 text-center md:grid-cols-3 md:gap-8">
      <div>
        <div className="mb-2 font-[family-name:var(--font-bebas)] text-5xl leading-none">87%</div>
        <div className="text-xs uppercase tracking-[0.08em] opacity-85">
          Average admin time saved
        </div>
      </div>
      <div>
        <div className="mb-2 font-[family-name:var(--font-bebas)] text-5xl leading-none">3X</div>
        <div className="text-xs uppercase tracking-[0.08em] opacity-85">
          Faster patient & client intake
        </div>
      </div>
      <div>
        <div className="mb-2 font-[family-name:var(--font-bebas)] text-5xl leading-none">$0</div>
        <div className="text-xs uppercase tracking-[0.08em] opacity-85">
          Cost of your first assessment
        </div>
      </div>
    </section>
  );
}
