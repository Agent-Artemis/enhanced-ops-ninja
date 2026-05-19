import Image from "next/image";
import Link from "next/link";

const NINJA_HERO_WIDTH = 200;

export function MarketingHero() {
  return (
    <section className="border-b border-[rgb(26_110_204/0.3)] bg-eon-black px-6 pb-12 pt-8">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-x-12 gap-y-6 md:grid-cols-2 md:grid-rows-[auto_1fr] md:gap-y-12">
        <h1 className="z-[2] order-1 mb-0 font-[family-name:var(--font-bebas)] text-[42px] uppercase leading-[1.15] tracking-[0.02em] md:col-start-1 md:row-start-1 md:text-[48px]">
          <span className="text-white">STOP DOING IT</span>
          <br />
          <span className="text-eon-blue">THE HARD WAY</span>
        </h1>
        <div className="contents md:col-start-2 md:row-start-1 md:row-span-2 md:grid md:grid-cols-[minmax(0,1fr)_auto] md:grid-rows-[auto_auto] md:gap-x-4 md:gap-y-12">
          <p className="z-[2] order-2 mb-0 font-[family-name:var(--font-bebas)] text-[32px] uppercase leading-tight tracking-[0.04em] text-white md:order-none md:col-start-1 md:row-start-1">
            Cut Chaos. Get Results.
            <br />
            <span className="text-eon-blue">... Like a Ninja.</span>
          </p>
          <div className="z-[2] order-4 md:order-none md:col-start-1 md:row-start-2">
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
          <div className="z-[2] hidden md:col-start-2 md:row-start-1 md:flex md:justify-end md:self-end">
            <Image
              src="/Ninja_Transparent.png"
              alt=""
              width={NINJA_HERO_WIDTH}
              height={300}
              className="h-auto w-[200px] object-contain"
            />
          </div>
        </div>
        <div className="z-[2] order-3 flex flex-col md:col-start-1 md:row-start-2">
          <p className="mb-6 text-[18px] font-semibold uppercase tracking-[0.15em] text-[rgb(255_255_255/0.55)]">
            Enhanced operations and assessments
          </p>
          <p className="mb-6 text-sm leading-relaxed text-[rgb(255_255_255/0.55)]">
            Whether you run a medical practice or a growing business — we deploy AI automation that
            eliminates manual work, recovers lost revenue, and scales your operations without hiring
            more staff.
          </p>
          <div className="mb-4 flex flex-wrap gap-3">
            <a
              href="#assessment"
              className="inline-flex cursor-pointer items-center justify-center rounded-lg border-none bg-eon-blue px-7 py-3.5 text-[15px] font-medium text-white no-underline transition hover:bg-[#1562b8]"
            >
              Take Me to the Assessments
            </a>
          </div>
          <p className="text-xs text-[rgb(255_255_255/0.4)]">
            🔒 HIPAA-compliant infrastructure | No obligation | Results in 24 hours
          </p>
        </div>
      </div>
      <div className="mx-auto mt-10 flex max-w-[1200px] justify-center md:hidden">
        <Link
          href="/assessment"
          className="inline-flex cursor-pointer items-center justify-center rounded-md border border-eon-blue bg-transparent px-5 py-2.5 text-[13px] font-medium text-eon-blue no-underline"
        >
          Take Free Assessment
        </Link>
      </div>
    </section>
  );
}
