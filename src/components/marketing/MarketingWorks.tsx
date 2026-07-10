import { Fragment, type ReactNode } from "react";
import Image from "next/image";

type Row = { label: RowLabel; text: string };
type RowLabel = "Focus" | "What we do" | "What you get";

const PILL_TONE: Record<RowLabel, string> = {
  Focus: "bg-[rgb(255_255_255/0.06)] text-[rgb(255_255_255/0.5)]",
  "What we do": "bg-[rgb(26_110_204/0.15)] text-eon-blue",
  "What you get": "bg-[rgb(26_110_204/0.22)] text-[#5aa0ea]",
};

// Shared card shell — dark surface, 16px radius, 4px full-height blue rail on the left.
const CARD =
  "relative overflow-hidden rounded-2xl border border-[rgb(255_255_255/0.08)] bg-eon-card " +
  "p-6 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.55)] " +
  "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-eon-blue before:content-['']";

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

      {/* The five mission steps — one-pager card stack */}
      <div className="mx-auto max-w-[760px]">
        <p className="mb-6 text-center text-[13px] font-semibold uppercase tracking-[0.14em] text-eon-blue">
          The Path · Five Moves to Launch
        </p>

        <div className="flex flex-col">
          <PathCard
            num="01"
            image="/Ninja_Meditation-transparent.png"
            title="Assessment"
            rows={[
              { label: "Focus", text: "Time · Finance · Staffing · Patient Care" },
              { label: "What we do", text: "Deep-dive ops audit" },
              { label: "What you get", text: "Identify your leverage gaps" },
            ]}
          />
          <NinjaConnector />
          <PathCard
            num="02"
            image="/Ninja_Shurikan-removebg-preview.png"
            title="Secret Mission Briefing"
            rows={[
              { label: "Focus", text: "Custom ROI breakdown" },
              { label: "What we do", text: "Presented to the decision-maker" },
              { label: "What you get", text: "Recommended mission path" },
            ]}
          />
          <NinjaConnector />
          <PathCard
            num="03"
            image="/Ninja_with_sword-removebg-preview.png"
            title="Mission Service Agreement"
            rows={[
              { label: "Focus", text: "Agreement authorized" },
              { label: "What we do", text: "Kickoff scheduled" },
              { label: "What you get", text: "Mission activated" },
            ]}
          />
          <NinjaConnector />
          <PathCard
            num="04"
            image="/Ninja_horse_stance-transparent.png"
            title="Mission Funding"
            rows={[
              { label: "Focus", text: "Scope & timeline aligned" },
              { label: "What we do", text: "Terms agreed" },
              { label: "What you get", text: "Investment confirmed" },
            ]}
          />
          <NinjaConnector />
          <PathCard
            num="05"
            image="/Ninja_Flying_Side_Kick-Transparent.png"
            title="Team Briefing"
            rows={[
              { label: "Focus", text: "Mission map built" },
              { label: "What we do", text: "Team fully onboarded" },
              { label: "What you get", text: "Mission launch activated" },
            ]}
          />
        </div>
      </div>

      {/* The three deployment phases — preserved as phase eyebrows above their cards */}
      <div className="mx-auto mt-14 max-w-[760px]">
        <h3 className="mb-8 text-center font-[family-name:var(--font-bebas)] text-[42px] uppercase leading-none tracking-[0.04em] text-eon-blue [text-wrap:balance]">
          Three Phases of Deployment
        </h3>

        <div className="flex flex-col">
          <PhaseBlock
            numeral="I"
            phase="Quick Strikes"
            headline="Agentic Automation"
            points={[
              "Agentic Voice AI — front desk",
              "Dashboard automation",
              "Insurance verification",
              "Medicare Advantage contract review",
            ]}
          />
          <NinjaConnector />
          <PhaseBlock
            numeral="II"
            phase="Fortify Position"
            headline="Ninja Operating Systems"
            points={[
              "Ninja OS — Business",
              "Ninja OS — Personal",
              "Sync with existing dashboards",
              "Full management visibility",
            ]}
          />
          <NinjaConnector />
          <PhaseBlock
            numeral="III"
            phase="Own Your Domain"
            headline="Custom EMR + The Ninja"
            points={[
              "Ninja EMR + PM Creator",
              "Office Ninja — your in-house agent",
              <Fragment key="emr-asset">
                Your EMR,{" "}
                <strong className="font-bold uppercase text-eon-blue">
                  YOUR ASSET!
                </strong>
              </Fragment>,
              "Full operational ownership",
            ]}
          />
        </div>
      </div>

      {/* Mission Complete — one-pager CTA box */}
      <div className="mx-auto mt-14 max-w-[760px]">
        <MissionCta />
      </div>
    </section>
  );
}

function PathCard(props: { num: string; image: string; title: string; rows: Row[] }) {
  return (
    <div className={CARD}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <span className="min-w-[2.1ch] font-[family-name:var(--font-bebas)] text-4xl leading-none text-eon-blue [font-variant-numeric:tabular-nums] tabular-nums">
            {props.num}
          </span>
          <h3 className="font-[family-name:var(--font-bebas)] text-2xl uppercase leading-none tracking-[0.03em]">
            {props.title}
          </h3>
        </div>
        <Image
          src={props.image}
          alt=""
          width={48}
          height={48}
          className="flex-none object-contain"
          style={{ background: "transparent" }}
        />
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[0.95rem] max-[560px]:grid-cols-1 max-[560px]:gap-y-1">
        {props.rows.map((r) => (
          <Fragment key={r.label}>
            <span
              className={`mt-0.5 inline-block self-start whitespace-nowrap rounded-full px-2 py-1 text-[0.66rem] font-semibold uppercase tracking-[0.11em] max-[560px]:mt-2 max-[560px]:justify-self-start ${PILL_TONE[r.label]}`}
            >
              {r.label}
            </span>
            <p className="leading-relaxed text-[rgb(255_255_255/0.55)]">{r.text}</p>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function PhaseBlock(props: { numeral: string; phase: string; headline: string; points: ReactNode[] }) {
  return (
    <div className={CARD}>
      <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-[rgb(255_255_255/0.4)]">
        Phase <span className="text-eon-blue">{props.numeral}</span> · {props.phase}
      </p>
      <h3 className="mb-4 font-[family-name:var(--font-bebas)] text-[32px] uppercase leading-none tracking-[0.03em]">
        {props.headline}
      </h3>
      <ul className="flex flex-col gap-1.5">
        {props.points.map((p, i) => (
          <li key={i} className="text-[13px] leading-relaxed text-[rgb(255_255_255/0.55)]">
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * NinjaConnector — subtle downward flow arrow between consecutive cards.
 * Purely decorative; delete every <NinjaConnector /> and this function to remove.
 */
function NinjaConnector() {
  return (
    <div aria-hidden="true" className="flex justify-center py-1.5 text-eon-blue">
      <svg width="26" height="52" viewBox="0 0 26 52" fill="none" role="presentation">
        <line x1="13" y1="2" x2="13" y2="34" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path
          d="M5 32l8 10 8-10"
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function MissionCta() {
  return (
    <div className="rounded-[20px] bg-gradient-to-br from-[#124e92] to-eon-blue px-8 py-10 text-center">
      <Image
        src="/Ninja_Meditation-transparent.png"
        alt=""
        width={64}
        height={64}
        className="mx-auto mb-3 object-contain"
        style={{ background: "transparent" }}
      />
      <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[rgb(255_255_255/0.7)]">
        Mission Complete
      </p>
      <h3 className="mt-1 font-[family-name:var(--font-bebas)] text-[34px] uppercase leading-none tracking-[0.03em] text-white">
        Operate Like a Ninja
      </h3>
      <p className="mx-auto mt-3 max-w-[30em] text-[14px] text-[rgb(255_255_255/0.85)]">
        Leverage recovered · Revenue protected · Team unstoppable
      </p>
      <a
        href="https://cal.com/enhancedopsninja/30-min"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-block rounded-xl bg-white px-8 py-3.5 text-[15px] font-semibold text-[#124e92] shadow-[0_8px_22px_-8px_rgba(0,0,0,0.5)] transition-transform hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      >
        Book 30 minutes with Jeff →
      </a>
      <p className="mt-5 font-[family-name:var(--font-dm)] italic text-[15px] text-[rgb(255_255_255/0.85)]">
        Rule your day. — Jeff
      </p>
    </div>
  );
}
