import type { ReactNode } from "react";
import Image from "next/image";

export function MarketingWorks() {
  return (
    <section className="bg-eon-black px-6 py-16">
      <div className="mx-auto mb-12 max-w-[900px] text-center">
        <h2 className="mb-2 font-[family-name:var(--font-bebas)] text-[42px] uppercase tracking-[0.04em]">
          HOW THE <span className="text-eon-blue">NINJA</span> WORKS
        </h2>
        <p className="text-[15px] text-[rgb(255_255_255/0.55)]">
          Four moves. Maximum impact. Zero fluff.
        </p>
      </div>
      <div className="mx-auto max-w-[900px]">
        <Step
          num="01"
          image={<Image src="/Ninja_Transparent.png" alt="Ninja leaping" width={80} height={80} />}
          title="WE ASSESS YOUR OPERATION"
          body="Take our Free Assessment or commit to change and take the Deep-Dive Assessment. Give us a picture of where your pain points are in your business. We review them and..."
        />
        <Step
          num="02"
          image={<Image src="/step-02-ninja.png" alt="Ninja with star" width={80} height={80} />}
          title="WE BUILD YOUR AUTOMATION ROADMAP"
          body="Our team analyzes your workflow gaps and designs a custom AI automation stack. You'll see exactly what to fix first, what it will cost, and what you'll get back in time and revenue."
        />
        <Step
          num="03"
          image={<Image src="/step-03-ninja.png" alt="Ninja jumping" width={80} height={80} />}
          title="WE DEPLOY THE TOOLS"
          body="From HIPAA-compliant voice AI for healthcare to accounts receivable automation for business — we implement solutions that go live in days, not months. No IT team required."
        />
        <Step
          num="04"
          image={<Image src="/step-04-ninja.png" alt="Ninja meditating" width={80} height={80} />}
          title="YOU OPERATE LIKE A MACHINE"
          body="Real-time dashboards. Automated front desk. Recovered AR. Fewer no-shows. More revenue. Your team stops doing manual work and starts doing what they were hired to do."
        />
      </div>
    </section>
  );
}

function Step(props: {
  num: string;
  image: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="mb-6 grid grid-cols-1 items-start gap-8 rounded-[10px] border border-[rgb(255_255_255/0.08)] bg-eon-dark p-8 md:grid-cols-[80px_1fr]">
      <div className="font-[family-name:var(--font-bebas)] text-5xl leading-none text-eon-blue">
        {props.num}
      </div>
      <div>
        <div className="mb-2">{props.image}</div>
        <h3 className="mb-2 font-[family-name:var(--font-bebas)] text-xl uppercase tracking-[0.03em]">
          {props.title}
        </h3>
        <p className="text-sm leading-relaxed text-[rgb(255_255_255/0.55)]">{props.body}</p>
      </div>
    </div>
  );
}
