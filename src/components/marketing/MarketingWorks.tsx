import Image from "next/image";

export function MarketingWorks() {
  return (
    <section className="bg-eon-black px-6 py-16">
      <div className="mx-auto mb-12 max-w-[1100px] text-center">
        <h2 className="mb-2 font-[family-name:var(--font-bebas)] text-[42px] uppercase tracking-[0.04em]">
          HOW THE <span className="text-eon-blue">NINJA</span> WORKS
        </h2>
        <p className="text-[15px] text-[rgb(255_255_255/0.55)]">
          The Ninja Path — your mission, executed.
        </p>
      </div>

      {/* The five mission steps */}
      <div className="mx-auto max-w-[1100px]">
        <p className="mb-6 text-center text-[13px] font-semibold uppercase tracking-[0.14em] text-eon-blue">
          The Path · Five Moves to Launch
        </p>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Step num="01" image="/Ninja_Transparent.png" title="Assessment"
            points={["Deep-dive ops audit", "Identify your leverage gaps", "Time · Finance · Staffing · Patient Care"]} />
          <Step num="02" image="/step-02-ninja.png" title="Secret Mission Briefing"
            points={["Custom ROI breakdown", "Recommended mission path", "Presented to the decision-maker"]} />
          <Step num="03" image="/step-03-ninja.png" title="Mission Service Agreement"
            points={["Agreement authorized", "Mission activated", "Kickoff scheduled"]} />
          <Step num="04" image="/step-04-ninja.png" title="Mission Funding"
            points={["Investment confirmed", "Scope & timeline aligned", "Terms agreed"]} />
          <Step num="05" image="/Ninja_Flying_Side_Kick-Transparent.png" title="Team Briefing"
            points={["Mission map built", "Team fully onboarded", "Mission launch activated"]} />
          <Complete />
        </div>
      </div>

      {/* The three deployment phases */}
      <div className="mx-auto mt-14 max-w-[1100px]">
        <p className="mb-6 text-center text-[13px] font-semibold uppercase tracking-[0.14em] text-eon-blue">
          Three Phases of Deployment
        </p>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Phase numeral="I" phase="Quick Strikes" headline="Agentic Automation"
            points={["Agentic Voice AI — front desk", "Dashboard automation", "Insurance verification", "Medicare Advantage contract review"]} />
          <Phase numeral="II" phase="Fortify Position" headline="Ninja Operating Systems"
            points={["Ninja OS — Business", "Ninja OS — Personal", "Sync with existing dashboards", "Full management visibility"]} />
          <Phase numeral="III" phase="Own Your Domain" headline="Custom EMR + The Ninja"
            points={["Ninja EMR + PM Creator", "Office Ninja — your in-house agent", "Your EMR, your asset", "Full operational ownership"]} />
        </div>
      </div>
    </section>
  );
}

function Step(props: { num: string; image: string; title: string; points: string[] }) {
  return (
    <div className="flex flex-col rounded-lg border border-[rgb(255_255_255/0.08)] border-l-[3px] border-l-eon-blue bg-eon-card p-6">
      <div className="mb-3 flex items-start justify-between">
        <span className="font-[family-name:var(--font-bebas)] text-5xl leading-none text-eon-blue">
          {props.num}
        </span>
        <Image src={props.image} alt="" width={56} height={56} className="object-contain" style={{ background: "transparent" }} />
      </div>
      <h3 className="mb-2 font-[family-name:var(--font-bebas)] text-xl uppercase tracking-[0.03em]">
        {props.title}
      </h3>
      <ul className="flex flex-col gap-1">
        {props.points.map((p) => (
          <li key={p} className="text-[13px] leading-relaxed text-[rgb(255_255_255/0.55)]">
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Complete() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-[rgb(26_110_204/0.3)] bg-eon-card p-6 text-center">
      <Image src="/Ninja_Meditation-transparent.png" alt="" width={64} height={64} className="mb-3 object-contain" style={{ background: "transparent" }} />
      <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-eon-blue">Mission Complete</p>
      <h3 className="mt-1 font-[family-name:var(--font-bebas)] text-2xl uppercase leading-none tracking-[0.03em]">
        Operate Like a Ninja
      </h3>
      <p className="mt-2 text-[13px] text-[rgb(255_255_255/0.55)]">
        Leverage recovered · Revenue protected · Team unstoppable
      </p>
    </div>
  );
}

function Phase(props: { numeral: string; phase: string; headline: string; points: string[] }) {
  return (
    <div className="flex flex-col rounded-lg border border-[rgb(255_255_255/0.08)] border-l-[3px] border-l-eon-blue bg-eon-card p-6">
      <div className="mb-3 border-b border-[rgb(255_255_255/0.08)] pb-3">
        <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[rgb(255_255_255/0.4)]">
          Phase <span className="text-eon-blue">{props.numeral}</span>
        </p>
        <h3 className="mt-1 font-[family-name:var(--font-bebas)] text-2xl uppercase leading-none tracking-[0.03em]">
          {props.phase}
        </h3>
        <p className="mt-1.5 text-[13px] font-semibold text-eon-blue">{props.headline}</p>
      </div>
      <ul className="flex flex-col gap-1">
        {props.points.map((p) => (
          <li key={p} className="text-[13px] leading-relaxed text-[rgb(255_255_255/0.55)]">
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}
