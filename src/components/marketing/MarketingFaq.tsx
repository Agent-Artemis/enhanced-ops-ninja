"use client";

import { useMemo, useState } from "react";

type FaqItem = { q: string; a: string };

export function MarketingFaq() {
  const items = useMemo<FaqItem[]>(
    () => [
      {
        q: "Is the free assessment really free?",
        a: "Yes — completely free, no credit card, no obligation. We review every submission personally and send you a real, customized response.",
      },
      {
        q: "How is healthcare data kept secure?",
        a: "All healthcare services operate under HIPAA-compliant infrastructure. Data submitted through this site is encrypted in transit and at rest and is never sold or shared.",
      },
      {
        q: "How fast can you implement?",
        a: "Most automation tools go live within days. After your strategy call, we give you a sequenced timeline based on your current systems and priorities.",
      },
      {
        q: "What size practices or businesses do you work with?",
        a: "Most of our clients range from $5M-$15M in annual revenue. The majority are in the healthcare industry, but we work in general business as well.",
      },
      {
        q: "What makes Enhanced Ops different from other AI vendors?",
        a: "We're not a software vendor — we're an operations partner. We build, deploy, and manage your automation stack, and we stay with you through implementation. You don't figure it out alone.",
      },
    ],
    [],
  );

  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="bg-eon-off-black px-6 py-16" id="faq">
      <div className="mx-auto mb-12 max-w-[800px] text-center">
        <h2 className="font-[family-name:var(--font-bebas)] text-[42px] uppercase tracking-[0.04em]">
          COMMON <span className="text-eon-blue">QUESTIONS</span>
        </h2>
      </div>
      <div className="mx-auto max-w-[800px]">
        {items.map((item, idx) => {
          const open = openIndex === idx;
          return (
            <div
              key={item.q}
              className="cursor-pointer border-b border-[rgb(255_255_255/0.08)] py-6 last:border-b-0"
              onClick={() => setOpenIndex(open ? null : idx)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpenIndex(open ? null : idx);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="flex items-center justify-between gap-4 text-[15px] font-medium">
                <span>{item.q}</span>
                <span
                  className={`text-xl text-eon-blue transition ${open ? "rotate-90" : ""}`}
                  aria-hidden
                >
                  ›
                </span>
              </div>
              <div
                className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
                  open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
              >
                <div className="min-h-0 overflow-hidden">
                  <p className="pt-4 text-[13px] leading-relaxed text-[rgb(255_255_255/0.55)]">
                    {item.a}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
