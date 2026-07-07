import type { ReactNode } from "react";

export function MarketingWorks() {
  return (
    <section className="bg-eon-black px-6 py-16">
      <div className="mx-auto mb-12 max-w-[960px] text-center">
        <h2 className="mb-2 font-[family-name:var(--font-bebas)] text-[42px] uppercase tracking-[0.04em]">
          HOW THE <span className="text-eon-blue">NINJA</span> WORKS
        </h2>
        <p className="text-[15px] text-[rgb(255_255_255/0.55)]">
          The Ninja Path — your mission, executed.
        </p>
      </div>

      {/* The five mission steps */}
      <div className="mx-auto max-w-[960px]">
        <p className="mb-5 font-[family-name:var(--font-bebas)] text-sm uppercase tracking-[0.22em] text-[rgb(255_255_255/0.4)]">
          The Path — Five Moves to Launch
        </p>
        <div className="relative">
          <Step
            num="01"
            icon="🔍"
            title="Assessment"
            points={["Deep-dive ops audit", "Identify your leverage gaps", "Across time, finance, staffing & patient care"]}
          />
          <Step
            num="02"
            icon="📋"
            title="Secret Mission Briefing"
            points={["Custom ROI breakdown", "Your recommended mission path", "Presented straight to the decision-maker"]}
          />
          <Step
            num="03"
            icon="✍️"
            title="Mission Service Agreement"
            points={["Agreement authorized", "Mission activated", "Kickoff scheduled"]}
          />
          <Step
            num="04"
            icon="💰"
            title="Mission Funding"
            points={["Investment confirmed", "Scope & timeline aligned", "Terms agreed"]}
          />
          <Step
            num="05"
            icon="🥷"
            title="Team Briefing"
            points={["Mission map built", "Team fully onboarded", "Mission launch activated"]}
            last
          />
        </div>
      </div>

      {/* The three delivery phases */}
      <div className="mx-auto mt-14 max-w-[1040px]">
        <p className="mb-5 text-center font-[family-name:var(--font-bebas)] text-sm uppercase tracking-[0.22em] text-[rgb(255_255_255/0.4)]">
          Three Phases of Deployment
        </p>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Phase
            numeral="I"
            phase="Quick Strikes"
            headline="Agentic Automation"
            points={["Agentic Voice AI — front desk", "Dashboard automation", "Insurance verification", "Medicare Advantage contract review"]}
          />
          <Phase
            numeral="II"
            phase="Fortify Position"
            headline="Ninja Operating Systems"
            points={["Ninja OS — Business", "Ninja OS — Personal", "Sync with existing dashboards", "Full management visibility"]}
          />
          <Phase
            numeral="III"
            phase="Own Your Domain"
            headline="Custom EMR + The Ninja"
            points={["Ninja EMR + PM Creator", "Office Ninja — your in-house agent", "Your EMR, your asset", "Full operational ownership"]}
          />
        </div>
      </div>

      {/* Mission complete */}
      <div className="mx-auto mt-14 max-w-[960px]">
        <div className="rounded-[14px] border border-[rgb(26_110_204/0.4)] bg-[linear-gradient(135deg,rgb(18_78_146/0.35),rgb(26_110_204/0.15))] p-10 text-center">
          <div className="mb-3 text-3xl">🎉</div>
          <p className="font-[family-name:var(--font-bebas)] text-sm uppercase tracking-[0.22em] text-eon-blue">
            Mission Complete
          </p>
          <h3 className="mt-2 font-[family-name:var(--font-bebas)] text-[34px] uppercase leading-none tracking-[0.03em]">
            Now You Operate Like a <span className="text-eon-blue">Ninja</span>
          </h3>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-[rgb(255_255_255/0.7)]">
            <span>Leverage recovered</span>
            <span className="text-eon-blue">·</span>
            <span>Revenue protected</span>
            <span className="text-eon-blue">·</span>
            <span>Team unstoppable</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Step(props: {
  num: string;
  icon: string;
  title: string;
  points: string[];
  last?: boolean;
}) {
  return (
    <div className="relative grid grid-cols-[64px_1fr] items-start gap-5 md:grid-cols-[80px_1fr] md:gap-8">
      {/* number + connecting spine */}
      <div className="relative flex flex-col items-center">
        <div className="font-[family-name:var(--font-bebas)] text-5xl leading-none text-eon-blue">
          {props.num}
        </div>
        {!props.last && (
          <div className="mt-2 w-px flex-1 bg-[linear-gradient(to_bottom,rgb(26_110_204/0.5),rgb(26_110_204/0.05))]" />
        )}
      </div>
      <div className="mb-6 rounded-[10px] border border-[rgb(255_255_255/0.08)] bg-eon-dark p-6 md:p-7">
        <div className="mb-2 flex items-center gap-3">
          <span className="text-2xl leading-none" aria-hidden="true">{props.icon}</span>
          <h3 className="font-[family-name:var(--font-bebas)] text-xl uppercase tracking-[0.03em]">
            {props.title}
          </h3>
        </div>
        <ul className="flex flex-col gap-1.5">
          {props.points.map((p) => (
            <li key={p} className="flex items-start gap-2 text-sm leading-relaxed text-[rgb(255_255_255/0.55)]">
              <span className="mt-[7px] h-1 w-1 flex-none rounded-full bg-eon-blue" aria-hidden="true" />
              {p}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Phase(props: {
  numeral: string;
  phase: string;
  headline: string;
  points: string[];
}) {
  return (
    <div className="flex flex-col rounded-[10px] border border-[rgb(255_255_255/0.08)] bg-eon-dark p-7">
      <div className="mb-4 border-b border-[rgb(255_255_255/0.08)] pb-4">
        <p className="font-[family-name:var(--font-bebas)] text-sm uppercase tracking-[0.16em] text-[rgb(255_255_255/0.4)]">
          Phase{" "}
          <span className="text-eon-blue">{props.numeral}</span>
        </p>
        <h3 className="mt-1 font-[family-name:var(--font-bebas)] text-2xl uppercase leading-none tracking-[0.03em]">
          {props.phase}
        </h3>
        <p className="mt-2 text-sm font-medium text-eon-blue">{props.headline}</p>
      </div>
      <ul className="flex flex-col gap-1.5">
        {props.points.map((p) => (
          <li key={p} className="flex items-start gap-2 text-sm leading-relaxed text-[rgb(255_255_255/0.55)]">
            <span className="mt-[7px] h-1 w-1 flex-none rounded-full bg-eon-blue" aria-hidden="true" />
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}
