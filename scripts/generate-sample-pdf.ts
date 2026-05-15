import fs from "node:fs";
import path from "node:path";

import * as dotenv from "dotenv";

import { generateReportHTML } from "../src/lib/ops-report/report-template";
import type { ReportData } from "../src/types/report";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const SMITHS_DATA: ReportData = {
  client_name: "Michael Smith",
  organization_name: "Smith's General Business",
  track: "general_business",
  completed_at: "May 14, 2026",
  annual_revenue: 2_100_000,
  team_size: 18,
  overall_score: 55,
  overall_status: "YELLOW",
  total_dollar_loss: 647_500,
  total_dollar_loss_label: "$647K",
  executive_narrative:
    "Smith's General Business is functional — and that's exactly the problem. You've built something real. But this assessment reveals a business running harder than it needs to, on systems built for a smaller version of what you're trying to become. The $647K identified in this report is not a penalty — it's your roadmap.",
  total_points_earned: 110,
  max_possible_points: 208,
  priority_1_module: "Marketing & Growth",
  priority_1_finding:
    "No lead capture, no paid advertising, no referral system — Smith's is relying entirely on word of mouth. This is a ceiling, not a strategy.",
  priority_2_module: "Financial Health & Revenue",
  priority_2_finding:
    "Operating margin ~8% with no segment P&L — 6 points below benchmark — represents $126K in uncaptured margin annually.",
  priority_3_module: "Manual Tasks & Automation Readiness",
  priority_3_finding:
    "15+ automatable admin hours per week at $28/hr loaded cost = $87K/yr in labor spent on tasks software handles better.",
  modules: [
    {
      module_number: 1,
      module_name: "Financial Health & Revenue",
      module_score_pct: 64,
      status_color: "YELLOW",
      dollar_loss_calculated: 126_000,
      dollar_loss_label: "$126K",
      recommended_offer: "Business Transparency Dashboards",
      recommended_offer_description:
        "Real-time visibility into your business — revenue, pipeline, margin by segment, and team performance.",
      deployment_timeline: "30–45 day deployment",
      expected_impact: "$126K in margin gap recovered through visibility and segment-level optimization.",
      findings: [
        "Your operating margin sits at ~8% — 6 full points below the 14% industry benchmark for businesses at your revenue level. At $2.1M in revenue, that gap is worth $126,000 per year in operating profit left on the table.",
        "All revenue runs together — no P&L breakout by product line or client type. You may be subsidizing an unprofitable service line with revenue from a healthy one and have no visibility into it.",
      ],
      actions: [
        "Build a segment-level P&L within 30 days — break revenue and direct costs out by product or service type.",
        "Add cash flow and balance sheet to your monthly review. P&L alone is not financial management.",
        "Set a precise break-even number and review it quarterly as your cost structure shifts.",
      ],
      calc_table: [
        { input: "Annual revenue", value: "$2,100K", source: "Client provided" },
        { input: "Reported operating margin", value: "~8%", source: "Assessment answer (Q5)" },
        { input: "Industry benchmark margin", value: "14%", source: "SMB industry average" },
        { input: "Margin gap", value: "6 points", source: "Benchmark minus reported" },
        { input: "Calculated annual loss", value: "$2,100K × 6% = $126K", source: "" },
      ],
    },
    {
      module_number: 2,
      module_name: "Staffing & HR Operations",
      module_score_pct: 46,
      status_color: "RED",
      dollar_loss_calculated: 63_000,
      dollar_loss_label: "$63K",
      recommended_offer: "Automation for Manual Tasks",
      recommended_offer_description:
        "Eliminate the repetitive admin burden that burns good people out — redirect that time to work that matters.",
      deployment_timeline: "45–60 day deployment",
      expected_impact: "Reduced burnout-driven turnover — $63K/yr in replacement costs recovered.",
      findings: [
        "Turnover is running ~30% annually — double the 15% benchmark. At 18 FTEs, that means 3–4 extra departures per year costing $18K each to replace. Conservative. Does not include productivity loss during vacancy.",
        "No formal retention strategy exists. You are finding out why people leave at the exit interview — after the decision has already been made and the cost already incurred.",
      ],
      actions: [
        "Implement stay interviews immediately — ask your current team what would make them consider leaving.",
        "Build a 30/60/90-day onboarding program within 60 days with defined milestones.",
        "Move to documented annual performance reviews with written goals.",
      ],
      calc_table: [
        { input: "Team size", value: "18 FTEs", source: "Client provided" },
        { input: "Reported turnover rate", value: "~30%", source: "Assessment answer" },
        { input: "Benchmark turnover", value: "15%", source: "SHRM 2024 SMB average" },
        { input: "Extra departures/yr", value: "3.5", source: "(30%−15%) × 18 FTEs" },
        { input: "Replacement cost/person", value: "$18,000", source: "SHRM 2024 conservative midpoint" },
        { input: "Calculated annual loss", value: "3.5 × $18,000 = $63K", source: "" },
      ],
    },
    {
      module_number: 3,
      module_name: "Accounts Receivable & Collections",
      module_score_pct: 59,
      status_color: "YELLOW",
      dollar_loss_calculated: 44_100,
      dollar_loss_label: "$44K",
      recommended_offer: "Agentic Voice Accounts Receivable",
      recommended_offer_description:
        "AI-powered collections follow-up, payment reminders, and invoice tracking — without adding headcount.",
      deployment_timeline: "30–45 day deployment",
      expected_impact: "DSO reduced by 8–15 days; bad debt cut 40–60%. $44K/yr recovered.",
      findings: [
        "~25–35% of invoices are coming in late, pushing DSO above 40 days.",
        "Bad debt write-off rate is ~3% of AR annually. Combined with carrying cost, that is $44K per year absorbed without being recognized as a recoverable line item.",
      ],
      actions: [
        "Run a full AR aging report this week — every account over 60 days needs a specific action and deadline.",
        "Build a formal collections sequence: 7-day reminder, 14-day follow-up call, 30-day formal notice.",
        "Create a written invoice dispute protocol — acknowledge within 24 hours, resolve within 5 business days.",
      ],
      calc_table: [
        { input: "Annual revenue", value: "$2,100K", source: "Client provided" },
        { input: "Average DSO", value: "~42 days", source: "Assessment answer (Q3)" },
        { input: "Estimated AR balance", value: "~$420K", source: "$2.1M ÷ 365 × 73-day cycle" },
        { input: "Bad debt write-off rate", value: "~3%", source: "Assessment answer (Q8)" },
        { input: "Bad debt annual cost", value: "$12.6K", source: "$420K × 3%" },
        { input: "Carrying cost on AR", value: "$31.5K", source: "$420K × 7.5%" },
        { input: "Calculated annual loss", value: "$12.6K + $31.5K = $44K", source: "" },
      ],
    },
    {
      module_number: 4,
      module_name: "Manual Tasks & Automation Readiness",
      module_score_pct: 46,
      status_color: "RED",
      dollar_loss_calculated: 87_360,
      dollar_loss_label: "$87K",
      recommended_offer: "Automation for Manual Tasks + Record & Data Consolidation",
      recommended_offer_description: "Eliminate repetitive workflows and unify fragmented data across systems.",
      deployment_timeline: "45–75 day deployment",
      expected_impact: "15 hrs/wk recovered = $87K/yr redirected from admin to revenue-generating work.",
      findings: [
        "More than half of daily admin work is still manual.",
        "No task management system is in use. Work lives in email and text messages.",
      ],
      actions: [
        "Audit your top 10 most frequent admin tasks this week — map your $87K opportunity in 30 minutes.",
        "Implement a team-wide task management system within 30 days.",
        "Automate your top 3 manual workflows within 60 days — start highest-frequency, lowest-complexity.",
      ],
      calc_table: [
        { input: "Automatable admin hrs/wk", value: "15 hrs", source: "Assessment (Q1) — conservative for team size" },
        { input: "Loaded labor cost/hr", value: "$28/hr", source: "Wages + 40% benefits/overhead" },
        { input: "Calculated annual loss", value: "15 × $28 × 52 = $87K", source: "Labor cost of automatable work" },
      ],
    },
    {
      module_number: 5,
      module_name: "Phone Systems & Communication",
      module_score_pct: 55,
      status_color: "YELLOW",
      dollar_loss_calculated: 42_000,
      dollar_loss_label: "$42K",
      recommended_offer: "Agentic Voice Front Desk",
      recommended_offer_description: "Every inbound call answered. Every lead captured. 24/7.",
      deployment_timeline: "30–45 day deployment",
      expected_impact: "Zero missed calls — 12+ leads/yr recovered at $3,500 avg value = $42K.",
      findings: [
        "Basic VoIP exists but call analytics are not tracked.",
        "No call protocols exist — experience varies entirely by who picks up.",
      ],
      actions: [
        "Turn on your VoIP call analytics this week — pull 30 days of answer rate and voicemail data.",
        "Write scripted call guides for your top 5 call types within 30 days.",
        "Set up an after-hours response within 45 days — minimum a professional voicemail with guaranteed callback time.",
      ],
      calc_table: [
        { input: "Est. inbound leads/month", value: "~25", source: "Revenue ÷ avg. transaction value" },
        { input: "Missed/mishandled call rate", value: "~12%", source: "Assessment answers (Q2, Q3, Q5)" },
        { input: "Lost leads per year", value: "12", source: "25 × 12% × 12 months" },
        { input: "Avg. transaction value", value: "$3,500", source: "$2.1M ÷ est. 600 annual transactions" },
        { input: "Calculated annual loss", value: "12 × $3,500 = $42K", source: "" },
      ],
    },
    {
      module_number: 6,
      module_name: "Staff Roles & Org Structure",
      module_score_pct: 70,
      status_color: "YELLOW",
      dollar_loss_calculated: 22_000,
      dollar_loss_label: "$22K",
      recommended_offer: "Operations & Retention Consulting",
      recommended_offer_description: "Strategic consulting on structure, retention, and operational monitoring.",
      deployment_timeline: "Ongoing strategic engagement",
      expected_impact: "$22K/yr in manager rework and key-person disruption costs eliminated.",
      findings: [
        "Escalation clarity is inconsistent — not formally documented.",
        "Limited cross-training leaves key-person dependency risk.",
      ],
      actions: [
        "Document a one-page escalation matrix for each role within 30 days.",
        "Identify your top 3 single points of failure and build cross-training plans within 60 days.",
        "Audit your management layer's actual workload — if stretched, the structure is the problem, not the people.",
      ],
      calc_table: [
        { input: "Mgmt rework hrs/wk", value: "4 hrs", source: "Assessment (Q3) — escalation inconsistency" },
        { input: "Manager loaded rate", value: "$42/hr", source: "Senior staff rate estimate" },
        { input: "Annual rework cost", value: "$8.7K", source: "4 × $42 × 52 wks" },
        { input: "Key-person disruption/yr", value: "$11K", source: "Assessment (Q5) — limited cross-training" },
        { input: "Calculated annual loss", value: "$8.7K + $11K ≈ $22K", source: "" },
      ],
    },
    {
      module_number: 7,
      module_name: "Labor Costs & Workforce Economics",
      module_score_pct: 46,
      status_color: "RED",
      dollar_loss_calculated: 68_040,
      dollar_loss_label: "$68K",
      recommended_offer: "Automation for Manual Tasks + Business Transparency Dashboards",
      recommended_offer_description: "Reduce labor cost through automation. Track the savings in real time.",
      deployment_timeline: "45–60 day deployment",
      expected_impact: "$68K/yr in labor efficiency recovered — tracked in your dashboard.",
      findings: [
        "Labor is consuming ~45–55% of revenue. Overtime is unplanned and no one is modeling the annual cost.",
        "Wages have not been benchmarked in over a year.",
      ],
      actions: [
        "Calculate your annualized overtime cost this month — total OT hours × loaded rate.",
        "Run a market wage comparison on your top 5 roles within 30 days.",
        "Set revenue per FTE as a monthly KPI reviewed in your leadership meeting.",
      ],
      calc_table: [
        { input: "Team size", value: "18 FTEs", source: "Client provided" },
        { input: "Avg loaded cost/FTE", value: "$52K/yr", source: "Wages + benefits + overhead" },
        { input: "Total annual labor cost", value: "$936K", source: "18 × $52K" },
        { input: "Efficiency gap", value: "7.5%", source: "Untracked OT + manual-heavy ops" },
        { input: "Gross opportunity", value: "$70.2K", source: "$936K × 7.5%" },
        { input: "Non-addressable (23%)", value: "−$16.2K", source: "Fixed structural labor" },
        { input: "Calculated annual loss", value: "$68K net", source: "Addressable efficiency gap" },
      ],
    },
    {
      module_number: 8,
      module_name: "Marketing & Growth",
      module_score_pct: 41,
      status_color: "RED",
      dollar_loss_calculated: 195_000,
      dollar_loss_label: "$195K",
      recommended_offer: "RevScan AI — Full Marketing Audit",
      recommended_offer_description:
        "60–90 second diagnostic of your digital presence, funnel, and ad spend scored across 15 levers.",
      deployment_timeline: "Immediate — runs in under 2 minutes",
      expected_impact: "$195K addressable growth gap — highest single lever in this report.",
      findings: [
        "No lead capture mechanism, no paid advertising, no referral system.",
        "No formal marketing audit has ever been done.",
      ],
      actions: [
        "Deploy a lead capture mechanism on your website within 14 days — lead magnet + automated follow-up.",
        "Build a structured referral outreach program within 30 days — identify top 10 sources, create monthly touchpoints.",
        "Run a RevScan AI audit immediately — 15-lever score of your digital presence in 60 seconds.",
      ],
      calc_table: [
        { input: "Current annual revenue", value: "$2,100K", source: "Client provided" },
        { input: "Est. growth (word-of-mouth only)", value: "~4%/yr", source: "Implied by D answers on Q3, Q4" },
        { input: "Benchmark growth (active mktg)", value: "~13%/yr", source: "SMB avg with digital + referral" },
        { input: "Addressable gap", value: "9.3 pts", source: "13% − 4% = 9.3% addressable" },
        { input: "Calculated annual opportunity", value: "$2,100K × 9.3% = $195K", source: "" },
      ],
    },
  ],
  phase_1_recommendations: [
    {
      module: "Marketing & Growth",
      offer: "RevScan AI + Lead Capture + Referral System",
      target_outcome: "First lead capture live, RevScan complete, referral outreach active",
      dollar_recovery: "$195K",
    },
    {
      module: "Staffing & HR",
      offer: "Stay Interviews + Onboarding Program",
      target_outcome: "Turnover begins declining within 90 days",
      dollar_recovery: "$63K",
    },
  ],
  phase_2_recommendations: [
    {
      module: "Automation Readiness",
      offer: "Automation for Manual Tasks + Data Consolidation",
      target_outcome: "Top 5 manual workflows automated, task system org-wide",
      dollar_recovery: "$87K",
    },
    {
      module: "AR & Collections",
      offer: "Agentic Voice Accounts Receivable",
      target_outcome: "AR aging over 90 days cut 40–60%",
      dollar_recovery: "$44K",
    },
  ],
  phase_3_recommendations: [
    {
      module: "Financial Health + Labor",
      offer: "Business Transparency Dashboards",
      target_outcome: "Real-time margin, labor cost, revenue per FTE in one dashboard",
      dollar_recovery: "$194K",
    },
    {
      module: "Phone Systems + Org",
      offer: "Agentic Voice Front Desk + Ops Consulting",
      target_outcome: "Every call answered, escalation matrix live",
      dollar_recovery: "$64K",
    },
  ],
  answers: [
    { module_name: "Financial Health & Revenue", question_number: 1, question_text: "Gross margin tracked", answer_choice: "B", answer_points: 3 },
  ],
};

async function generateSamplePDF(): Promise<void> {
  const html = generateReportHTML(SMITHS_DATA);
  const token = process.env.BLESS_TOKEN;
  if (!token) {
    throw new Error("Missing BLESS_TOKEN — cannot call Browserless");
  }

  const response = await fetch(`https://chrome.browserless.io/pdf?token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      html,
      options: {
        format: "A4",
        printBackground: true,
        margin: { top: "0", right: "0", bottom: "0", left: "0" },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Browserless error: ${response.status} ${await response.text()}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const outPath = path.join(process.cwd(), "public", "sample-report.pdf");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buffer);
}

generateSamplePDF()
  .then(() => {
    console.log("Wrote public/sample-report.pdf");
  })
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  });
