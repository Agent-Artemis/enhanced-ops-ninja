import type { StatusColor } from "@/lib/ops-report/scoring";

export type OpsTrack = "healthcare" | "general_business";

type StatusMap = Record<StatusColor, string[]>;
type ModuleMap = Record<number, StatusMap>;

export const MODULE_ACTIONS: Record<OpsTrack, ModuleMap> = {
  general_business: {
    1: {
      RED: [
        "Build a segment-level P&L within 30 days — break revenue and direct costs by product or service type.",
        "Add cash and working-capital metrics to your monthly review cadence.",
        "Set a precise break-even target and reconcile it quarterly to actuals.",
      ],
      YELLOW: [
        "Tighten monthly close discipline — publish management reports by day 7 each month.",
        "Validate margin assumptions with a simple cohort or customer-type view.",
        "Document top 5 drivers of margin variance and assign owners.",
      ],
      GREEN: [
        "Stress-test margin scenarios (+10% COGS, −5% volume) quarterly.",
        "Automate distribution of financial KPIs to department heads.",
        "Maintain a single source of truth for revenue recognition rules.",
      ],
    },
    2: {
      RED: [
        "Run stay interviews within 14 days for your highest-impact roles.",
        "Publish a written 30/60/90 onboarding path with clear competency checks.",
        "Track turnover and time-to-productivity monthly — set a reduction target.",
      ],
      YELLOW: [
        "Standardize job scorecards and quarterly check-ins for every role.",
        "Add a lightweight coverage playbook for peak weeks and PTO.",
        "Benchmark comp bands for top 5 roles this quarter.",
      ],
      GREEN: [
        "Institutionalize succession depth for mission-critical roles.",
        "Run an annual culture and engagement pulse tied to action plans.",
        "Keep onboarding assets evergreen with version control.",
      ],
    },
    3: {
      RED: [
        "Produce a full AR aging weekly until >90-day buckets trend down.",
        "Implement a written collections cadence with owner and SLA per bucket.",
        "Define dispute resolution SLAs and measure cycle time.",
      ],
      YELLOW: [
        "Automate payment reminders for invoices >7 days outstanding.",
        "Tighten credit holds and deposit requirements for chronic late payers.",
        "Review DSO and bad debt monthly in leadership meetings.",
      ],
      GREEN: [
        "Optimize payment terms selectively for strategic accounts.",
        "Automate cash application and reconciliation where volume warrants.",
        "Maintain a reserve policy aligned to observed write-off history.",
      ],
    },
    4: {
      RED: [
        "Inventory top 10 manual workflows and rank by frequency × minutes.",
        "Select a team-wide task system and migrate top workflows within 30 days.",
        "Pilot one high-ROI automation (routing, intake, or scheduling) in 60 days.",
      ],
      YELLOW: [
        "Document SOPs for the top 5 cross-team handoffs.",
        "Add basic workflow metrics (cycle time, reopen rate) to weekly ops review.",
        "Evaluate AI copilots for document-heavy processes.",
      ],
      GREEN: [
        "Maintain an automation roadmap tied to ROI thresholds.",
        "Quarterly audit for shadow IT and duplicate systems.",
        "Share wins internally to sustain adoption momentum.",
      ],
    },
    5: {
      RED: [
        "Enable core call analytics (answer rate, abandon, hold) this week.",
        "Write scripts for top inbound scenarios and train the team.",
        "Add after-hours coverage or guaranteed callback within 15 minutes.",
      ],
      YELLOW: [
        "Review weekly dashboards for missed calls and voicemail aging.",
        "Align phone tree with how customers actually navigate issues.",
        "Test failover paths quarterly.",
      ],
      GREEN: [
        "Integrate call outcomes with CRM for closed-loop reporting.",
        "Tune IVR quarterly based on containment and CSAT.",
        "Maintain playbooks for escalations and VIP handling.",
      ],
    },
    6: {
      RED: [
        "Publish a one-page escalation matrix by role within 30 days.",
        "Identify top 3 single points of failure and cross-train backups.",
        "Clarify decision rights between owner, managers, and ICs.",
      ],
      YELLOW: [
        "Refresh job descriptions and RACI for revenue-critical functions.",
        "Run a quarterly workload reality-check for managers.",
        "Document critical vendor and client dependencies.",
      ],
      GREEN: [
        "Rotate leadership through operational reviews to prevent silos.",
        "Maintain succession plans for director+ roles.",
        "Keep org chart and systems permissions aligned monthly.",
      ],
    },
    7: {
      RED: [
        "Calculate annualized overtime cost and cap with approval workflow.",
        "Benchmark wages for top roles and close critical gaps.",
        "Set revenue-per-FTE as a monthly KPI with targets.",
      ],
      YELLOW: [
        "Implement simple labor productivity dashboards by department.",
        "Review scheduling practices for systemic overtime drivers.",
        "Track cost-to-hire and refine sourcing mix quarterly.",
      ],
      GREEN: [
        "Model flex staffing scenarios for seasonality.",
        "Maintain incentive alignment between sales and delivery labor.",
        "Run annual efficiency retros on major process changes.",
      ],
    },
    8: {
      RED: [
        "Ship a lead capture path on your site within 14 days.",
        "Launch a lightweight paid test with clear CPA guardrails.",
        "Stand up referral outreach to top 10 sources within 30 days.",
      ],
      YELLOW: [
        "Tighten lead response SLAs and measure compliance weekly.",
        "Improve landing pages for top 3 acquisition sources.",
        "Refresh creative quarterly with structured experiments.",
      ],
      GREEN: [
        "Scale winning channels with documented playbooks.",
        "Expand proof assets (case studies, reviews) systematically.",
        "Maintain a rolling 90-day growth experiment backlog.",
      ],
    },
  },
  healthcare: {
    1: {
      RED: [
        "Separate professional vs. facility economics in management reporting.",
        "Add payer-mix and denial-rate visibility to monthly finance review.",
        "Model cash impact of claim lag vs. benchmarks.",
      ],
      YELLOW: [
        "Tighten KPI pack for practice leaders (visits, RVUs, AR, margin).",
        "Reconcile contract rates annually against actual remits.",
        "Track underpayments and appeals as a managed workstream.",
      ],
      GREEN: [
        "Scenario-plan reimbursement shocks by top payers.",
        "Automate distribution of specialty-specific dashboards.",
        "Maintain defensible charge master review cadence.",
      ],
    },
    2: {
      RED: [
        "Stabilize coverage for peak clinics and seasonal demand.",
        "Harden credentialing and privileging tracking to reduce start delays.",
        "Address burnout signals with targeted workload relief pilots.",
      ],
      YELLOW: [
        "Standardize per diem and locums usage with approval tiers.",
        "Improve clinical onboarding checklists tied to outcomes.",
        "Quarterly review of open roles vs. patient access metrics.",
      ],
      GREEN: [
        "Maintain float pools or cross-training for high-variance roles.",
        "Keep competency matrices current for regulated roles.",
        "Run annual staffing model vs. actual utilization review.",
      ],
    },
    3: {
      RED: [
        "Daily worklist for >90-day AR by payer and denial category.",
        "Implement pre-visit estimates and point-of-service collections.",
        "Root-cause top denial codes weekly with owners.",
      ],
      YELLOW: [
        "Automate patient statements and payment plan offers.",
        "Tighten prior-auth tracking to prevent rework write-offs.",
        "Benchmark DSO by site and close outliers.",
      ],
      GREEN: [
        "Optimize patient financing options with compliance guardrails.",
        "Automate cash posting rules where clean remits allow.",
        "Maintain a reserve policy tied to denial trends.",
      ],
    },
    4: {
      RED: [
        "Digitize intake, referrals, and release-of-information bottlenecks.",
        "Consolidate duplicate patient communications channels.",
        "Pilot automation for eligibility checks and chart prep.",
      ],
      YELLOW: [
        "Add workflow SLAs for scheduling, referrals, and Rx renewals.",
        "Integrate task queues between front and back office.",
        "Evaluate HIPAA-safe AI for documentation burden.",
      ],
      GREEN: [
        "Maintain an automation backlog ranked by compliance risk times minutes saved.",
        "Quarterly review of EHR build vs. workflow reality.",
        "Track adoption metrics after each release.",
      ],
    },
    5: {
      RED: [
        "Ensure every clinic line has documented overflow handling.",
        "Add bilingual scripting for top call types where needed.",
        "Measure abandoned calls and voicemail return time daily until green.",
      ],
      YELLOW: [
        "Align phone tree with how patients schedule and cancel.",
        "Add secure callback options for sensitive inquiries.",
        "Review after-hours routing vs. on-call policy quarterly.",
      ],
      GREEN: [
        "Integrate telephony metrics with access and satisfaction dashboards.",
        "Maintain disaster failover numbers and test semiannually.",
        "Tune prompts based on containment without harming CSAT.",
      ],
    },
    6: {
      RED: [
        "Clarify MA, RN, and provider scope and escalation in writing.",
        "Reduce single-threaded dependencies in billing and credentialing.",
        "Document who owns compliance tasks across sites.",
      ],
      YELLOW: [
        "Refresh supervisory spans where manager load is excessive.",
        "Align committee structure to decisions that actually get made.",
        "Standardize site manager playbook for openings and closures.",
      ],
      GREEN: [
        "Maintain clinical and ops co-leadership forums monthly.",
        "Keep governance calendar aligned to regulatory changes.",
        "Rotate audits across sites to spread learning.",
      ],
    },
    7: {
      RED: [
        "Quantify agency and locums premium vs. permanent staffing plan.",
        "Control OT in clinical areas with schedule redesign pilots.",
        "Benchmark clinical labor per unit of access vs. peers where available.",
      ],
      YELLOW: [
        "Tie scheduling templates to demand curves by modality.",
        "Track productivity wRVUs per FTE monthly by provider group.",
        "Review benefits design for unintended overtime incentives.",
      ],
      GREEN: [
        "Model productivity incentives against quality guardrails.",
        "Maintain float pools sized to historical no-show patterns.",
        "Annual review of outsourced services vs. insource economics.",
      ],
    },
    8: {
      RED: [
        "Fix online findability for key services and insurances accepted.",
        "Launch HIPAA-compliant lead capture and nurture for elective lines.",
        "Pilot geo-targeted campaigns with strict compliance review.",
      ],
      YELLOW: [
        "Improve Google Business Profiles per location with photos and Q&A.",
        "Add structured referral outreach to top community partners.",
        "Tighten review generation without policy violations.",
      ],
      GREEN: [
        "Scale service-line campaigns with landing page templates.",
        "Maintain content calendar tied to access goals.",
        "Quarterly competitive scan of local digital presence.",
      ],
    },
  },
};

export interface OfferEntry {
  offer: string;
  desc: string;
  timeline: string;
  impact: string;
}

export const OFFER_MAP: Record<OpsTrack, Record<number, OfferEntry>> = {
  general_business: {
    1: {
      offer: "Business Transparency Dashboards",
      desc: "Executive visibility into margin, pipeline, and labor KPIs in one place.",
      timeline: "30–45 day deployment",
      impact: "Recover margin gap through faster decisions and segment clarity.",
    },
    2: {
      offer: "Operations & Retention Consulting",
      desc: "Structured programs for onboarding, retention, and manager effectiveness.",
      timeline: "45–60 day deployment",
      impact: "Reduce turnover-driven replacement and productivity loss.",
    },
    3: {
      offer: "Agentic Voice Accounts Receivable",
      desc: "Automated follow-up, reminders, and status tracking without adding headcount.",
      timeline: "30–45 day deployment",
      impact: "Lower DSO and bad debt while improving cash predictability.",
    },
    4: {
      offer: "Automation for Manual Tasks + Data Consolidation",
      desc: "Workflow automation and unified operational data across core systems.",
      timeline: "45–75 day deployment",
      impact: "Reclaim admin hours and reduce errors from swivel-chair work.",
    },
    5: {
      offer: "Agentic Voice Front Desk",
      desc: "Always-on answering, lead capture, and intelligent routing.",
      timeline: "30–45 day deployment",
      impact: "Capture more inbound demand and reduce revenue leakage from missed calls.",
    },
    6: {
      offer: "Operations & Retention Consulting",
      desc: "Org design, escalation clarity, and cross-training roadmaps.",
      timeline: "Ongoing strategic engagement",
      impact: "Reduce rework and key-person disruption costs.",
    },
    7: {
      offer: "Automation + Dashboards Bundle",
      desc: "Labor efficiency automation paired with real-time cost tracking.",
      timeline: "45–60 day deployment",
      impact: "Addressable efficiency gap tracked to the dollar.",
    },
    8: {
      offer: "RevScan AI — Full Marketing Audit",
      desc: "Rapid diagnostic of digital presence, funnel, and paid channel readiness.",
      timeline: "Immediate — under 2 minutes",
      impact: "Prioritize highest-ROI growth fixes with quantified upside.",
    },
  },
  healthcare: {
    1: {
      offer: "Healthcare Financial Control Tower",
      desc: "Payer mix, denial, and margin visibility tailored to clinics and groups.",
      timeline: "45–60 day deployment",
      impact: "Tighten revenue integrity and protect margin under contracting pressure.",
    },
    2: {
      offer: "Clinical Operations & Workforce Stabilization",
      desc: "Coverage models, onboarding, and burnout reduction programs.",
      timeline: "45–75 day deployment",
      impact: "Improve access and reduce premium labor spend.",
    },
    3: {
      offer: "Revenue Cycle Automation Suite",
      desc: "Eligibility, AR worklists, and patient collections automation.",
      timeline: "30–60 day deployment",
      impact: "Reduce DSO and denial-driven write-offs.",
    },
    4: {
      offer: "Clinical Workflow Automation",
      desc: "Intake, referral, and documentation automation within HIPAA guardrails.",
      timeline: "45–90 day deployment",
      impact: "Lower admin burden per visit while improving throughput.",
    },
    5: {
      offer: "Patient Access Voice Layer",
      desc: "Smart scheduling, triage, and multilingual support for call volume.",
      timeline: "30–45 day deployment",
      impact: "Fewer abandoned calls and higher schedule utilization.",
    },
    6: {
      offer: "Healthcare Governance & Org Design",
      desc: "RACI, committee effectiveness, and compliance ownership clarity.",
      timeline: "Ongoing strategic engagement",
      impact: "Reduce operational risk and rework across sites.",
    },
    7: {
      offer: "Labor Productivity Analytics",
      desc: "wRVU per FTE, agency usage, and OT tracking with executive dashboards.",
      timeline: "30–45 day deployment",
      impact: "Sustainable labor model aligned to access targets.",
    },
    8: {
      offer: "Healthcare Growth & Reputation System",
      desc: "Compliant digital acquisition, referral activation, and review programs.",
      timeline: "30–60 day deployment",
      impact: "Grow booked visits without violating privacy or platform policies.",
    },
  },
};
