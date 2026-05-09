"use client";

import { useState } from "react";

type Tab = "healthcare" | "business";

export function MarketingServices() {
  const [tab, setTab] = useState<Tab>("healthcare");

  return (
    <section className="bg-eon-off-black px-6 py-16" id="services">
      <div className="mx-auto mb-10 max-w-[1100px] text-center">
        <h2 className="font-[family-name:var(--font-bebas)] text-[42px] uppercase tracking-[0.04em]">
          WHAT WE <span className="text-eon-blue">DEPLOY</span>
        </h2>
      </div>
      <div className="mx-auto mb-10 flex max-w-[1100px] justify-center gap-4">
        <button
          type="button"
          className={`cursor-pointer rounded-lg border px-6 py-2.5 text-sm font-medium transition ${
            tab === "healthcare"
              ? "border-eon-blue bg-eon-blue text-white"
              : "border-[rgb(255_255_255/0.15)] bg-eon-card text-[rgb(255_255_255/0.55)]"
          }`}
          onClick={() => setTab("healthcare")}
        >
          Healthcare
        </button>
        <button
          type="button"
          className={`cursor-pointer rounded-lg border px-6 py-2.5 text-sm font-medium transition ${
            tab === "business"
              ? "border-eon-blue bg-eon-blue text-white"
              : "border-[rgb(255_255_255/0.15)] bg-eon-card text-[rgb(255_255_255/0.55)]"
          }`}
          onClick={() => setTab("business")}
        >
          General Business
        </button>
      </div>
      <div className={tab === "healthcare" ? "block" : "hidden"}>
        <HealthcareGrid />
      </div>
      <div className={tab === "business" ? "block" : "hidden"}>
        <BusinessGrid />
      </div>
    </section>
  );
}

function HealthcareGrid() {
  return (
    <div className="mx-auto grid max-w-[1100px] grid-cols-1 gap-6 md:grid-cols-2">
      <ServiceCard icon="🗂️" title="Patient Record Consolidation" body="Unify fragmented records across all your systems into a single, clean source of truth." />
      <ServiceCard icon="📡" title="CCM & RPM Consulting" body="Chronic Care Management and Remote Patient Monitoring strategy, implementation, and billing optimization." />
      <ServiceCard
        icon="📞"
        title="Agentic Voice Front Desk"
        body="AI phone system that handles inbound calls, schedules appointments, and manages patient intake 24/7."
        badge="HIPAA"
      />
      <ServiceCard icon="🤖" title="Automation for Manual Tasks" body="Eliminate repetitive workflows: forms, referrals, follow-ups, prior auths, and more." />
      <ServiceCard icon="📊" title="Business Transparency Dashboards" body="Real-time visibility into your practice — revenue, capacity, outcomes, and staff performance." />
      <ServiceCard
        icon="🔍"
        title="Agentic Voice Insurance & Rx"
        body="AI handles insurance verification, benefits checks, and medication refill calls automatically."
        badge="HIPAA"
      />
      <ServiceCard
        icon="💵"
        title="Agentic Voice Accounts Receivable"
        body="AI calling system for collections, patient balance reminders, and payment plan setup."
        badge="HIPAA"
      />
    </div>
  );
}

function BusinessGrid() {
  return (
    <div className="mx-auto grid max-w-[1100px] grid-cols-1 gap-6 md:grid-cols-2">
      <ServiceCard icon="🗂️" title="Record & Data Consolidation" body="Unify fragmented customer and operational data across systems into a single source of truth." />
      <ServiceCard icon="📡" title="Operations & Retention Consulting" body="Strategic consulting on recurring revenue, customer retention, and monitoring." />
      <ServiceCard icon="📞" title="Agentic Voice Front Desk" body="AI phone system that handles inbound calls, schedules, and customer intake 24/7." />
      <ServiceCard icon="🤖" title="Automation for Manual Tasks" body="Eliminate repetitive workflows: data entry, follow-ups, reporting, and more." />
      <ServiceCard icon="📊" title="Business Transparency Dashboards" body="Real-time visibility into your business — revenue, pipeline, and team performance." />
      <ServiceCard icon="💵" title="Agentic Voice Accounts Receivable" body="AI calling system for collections, payment reminders, and invoice follow-up." />
    </div>
  );
}

function ServiceCard(props: { icon: string; title: string; body: string; badge?: string }) {
  return (
    <div className="rounded-lg border border-[rgb(255_255_255/0.08)] border-l-[3px] border-l-eon-blue bg-eon-card p-6">
      <div className="mb-2 flex items-start justify-between">
        <div className="text-[28px]">{props.icon}</div>
        {props.badge ? (
          <span className="rounded border border-[rgb(26_110_204/0.3)] bg-[rgb(26_110_204/0.2)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-eon-blue">
            {props.badge}
          </span>
        ) : null}
      </div>
      <h4 className="mb-2 text-[15px] font-semibold">{props.title}</h4>
      <p className="text-[13px] text-[rgb(255_255_255/0.55)]">{props.body}</p>
    </div>
  );
}
