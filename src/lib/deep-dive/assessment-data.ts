import type { BusinessTrack } from "@/lib/deep-dive/pricing";

export type DeepDiveChoiceLetter = "A" | "B" | "C" | "D";

export type DeepDiveChoiceMap = Record<DeepDiveChoiceLetter, string>;

export type DeepDiveQuestion = {
  id: string;
  moduleId: string;
  moduleIndex: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  prompt: string;
  choices: DeepDiveChoiceMap;
};

export type DeepDiveModuleMeta = {
  id: string;
  moduleIndex: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  title: string;
  questionCount: number;
};

const O1: DeepDiveChoiceMap = {
  A: "Strong — clear owners, documented practices, and routine leadership review",
  B: "Good — mostly consistent with a few known weak spots",
  C: "Limited — informal; outcomes depend on specific people being available",
  D: "Weak — undefined; we mostly react when problems surface",
};

const O2: DeepDiveChoiceMap = {
  A: "Excellent — dashboards and reviews drive weekly decisions",
  B: "Solid — key metrics exist but timing or ownership is uneven",
  C: "Emerging — metrics are partial or inconsistently refreshed",
  D: "Poor — we lack trustworthy visibility for leadership decisions",
};

const O3: DeepDiveChoiceMap = {
  A: "Mature — standardized workflow with quality checks and training",
  B: "Capable — standard process exists; exceptions are manageable",
  C: "Fragmented — multiple ways of working across teams or sites",
  D: "Chaotic — frequent rework, errors, or customer friction",
};

const O4: DeepDiveChoiceMap = {
  A: "Optimized — automation/integrations remove most manual handoffs",
  B: "Progressing — some automation; still meaningful manual work",
  C: "Manual-heavy — spreadsheets and shoulder-taps carry critical steps",
  D: "Brittle — single points of failure and limited documentation",
};

const O5: DeepDiveChoiceMap = {
  A: "Aligned — roles, spans, and escalation paths match how work really flows",
  B: "Mostly aligned — a few overlaps or gaps create occasional confusion",
  C: "Unclear — people improvise because ownership is fuzzy",
  D: "Misaligned — frequent turf issues or dropped handoffs",
};

const O6: DeepDiveChoiceMap = {
  A: "Proactive — we monitor risk, test changes, and track outcomes",
  B: "Steady — we handle common cases well; edge cases are harder",
  C: "Reactive — we fix issues after they impact operations or cash",
  D: "Absent — little structured improvement work in this area",
};

const CYCLE: DeepDiveChoiceMap[] = [O1, O2, O3, O4, O5, O6];

function pickChoices(i: number): DeepDiveChoiceMap {
  return CYCLE[i % CYCLE.length]!;
}

function makeQ(
  id: string,
  moduleId: string,
  moduleIndex: DeepDiveQuestion["moduleIndex"],
  prompt: string,
  choiceIdx: number,
): DeepDiveQuestion {
  return { id, moduleId, moduleIndex, prompt, choices: pickChoices(choiceIdx) };
}

const MODULE_IDS = {
  m1: "financials-revenue",
  m2: "staffing-hr",
  m3hc: "billing-revenue-cycle",
  m3bs: "ar-collections",
  m4: "manual-automation",
  m5: "phone-comms",
  m6: "roles-org",
  m7: "labor-economics",
} as const;

const M1_PROMPTS = [
  "How well can leadership explain gross margin drivers for the core service lines?",
  "How disciplined is monthly financial close and management reporting timeliness?",
  "How strong is revenue forecasting accuracy over the next 90 days?",
  "How clearly are pricing and discount decisions governed and documented?",
  "How well are cash collections tied to operational reporting (not just accounting)?",
  "How mature is cost-to-serve visibility by segment, site, or product line?",
  "How effective is the rhythm of financial review meetings (agenda, actions, follow-up)?",
];

const M2_PROMPTS = [
  "How clear are role definitions and competency expectations by function?",
  "How predictable and fair is the hiring pipeline for critical roles?",
  "How structured is onboarding so new hires reach productivity quickly?",
  "How consistently are performance expectations documented and reviewed?",
  "How well do you manage regrettable turnover and retention risk signals?",
  "How strong is scheduling and staffing alignment to demand (including peak periods)?",
  "How complete and current are required HR compliance records and policies?",
];

const M3_HC_PROMPTS = [
  "How strong is charge capture timeliness and accuracy before and after services?",
  "How consistently is eligibility verified to prevent preventable denials?",
  "How mature is coding and documentation specificity for the services you render?",
  "How disciplined is denial management (work queues, root-cause tracking, appeals)?",
  "How effective are patient collections workflows (estimates, plans, follow-up)?",
  "How routine are AR aging reviews with accountable owners and targets?",
  "How well are payer contracts and fee schedules maintained when changes occur?",
  "How monitored are claim submissions and clearinghouse rejections day-to-day?",
];

const M3_BS_PROMPTS = [
  "How timely and accurate are invoices relative to delivery milestones?",
  "How disciplined are AR aging buckets with weekly or monthly management routines?",
  "How clear is ownership for collections cadence, scripts, and escalation rules?",
  "How governed are credit checks, credit limits, and standard payment terms?",
  "How clean is cash application and reconciliation to open balances?",
  "How structured is dispute, deduction, and short-pay resolution?",
  "How well governed are write-offs, bad debt, and reserve policies?",
  "How leadership-ready are AR forecasts, DSO trends, and concentration reporting?",
];

const M4_PROMPTS = [
  "How much repetitive data entry still exists between core systems?",
  "How standardized are approvals for spend, discounts, exceptions, or overrides?",
  "How mature is integration between CRM, ERP, scheduling, and billing tools?",
  "How well are exception queues (errors, mismatches) owned and reduced over time?",
  "How practical is your automation roadmap (prioritized, funded, measured)?",
  "How resilient are critical workflows when a key person is out?",
];

const M5_PROMPTS = [
  "How reliable is call and message routing so customers or patients reach the right team?",
  "How complete are conversation logs for follow-up and quality assurance?",
  "How well do after-hours and overflow coverage protect revenue and experience?",
  "How consistent is omnichannel responsiveness (phone, email, SMS, portal)?",
  "How measurable is communication quality (service levels, abandon rates, callbacks)?",
];

const M6_PROMPTS = [
  "How current is the org chart and decision rights documentation?",
  "How healthy are manager spans for coaching, quality assurance, and escalation?",
  "How clear are RACI handoffs between front office, operations, and back office?",
  "How effective is cross-training for coverage without quality loss?",
  "How well do escalation paths prevent issues from stalling at the front line?",
];

const M7_PROMPTS = [
  "How well is labor cost tracked as a percentage of revenue by team or site?",
  "How controlled is overtime relative to demand variability?",
  "How strong are productivity benchmarks (per visit, per job, or per unit output)?",
  "How disciplined is scheduling optimization versus last-minute coverage gaps?",
  "How well are benefits and admin costs monitored against benchmarks?",
  "How thoughtful is the mix of W-2 employees, contractors, and temporary labor?",
];

function buildQuestions(
  prompts: string[],
  moduleIndex: DeepDiveQuestion["moduleIndex"],
  moduleId: string,
  idPrefix: string,
  choiceOffset: number,
): DeepDiveQuestion[] {
  return prompts.map((prompt, idx) =>
    makeQ(
      `${idPrefix}-q${String(idx + 1).padStart(2, "0")}`,
      moduleId,
      moduleIndex,
      prompt,
      choiceOffset + idx,
    ),
  );
}

export function getDeepDiveModules(track: BusinessTrack): DeepDiveModuleMeta[] {
  const m3Title =
    track === "healthcare" ? "Billing & Revenue Cycle" : "Accounts Receivable & Collections";
  return [
    { id: MODULE_IDS.m1, moduleIndex: 1, title: "Financials & Revenue Health", questionCount: 7 },
    { id: MODULE_IDS.m2, moduleIndex: 2, title: "Staffing & HR Operations", questionCount: 7 },
    { id: track === "healthcare" ? MODULE_IDS.m3hc : MODULE_IDS.m3bs, moduleIndex: 3, title: m3Title, questionCount: 8 },
    { id: MODULE_IDS.m4, moduleIndex: 4, title: "Manual Tasks & Automation Readiness", questionCount: 6 },
    { id: MODULE_IDS.m5, moduleIndex: 5, title: "Phone Systems & Communication", questionCount: 5 },
    { id: MODULE_IDS.m6, moduleIndex: 6, title: "Staff Roles & Organizational Structure", questionCount: 5 },
    { id: MODULE_IDS.m7, moduleIndex: 7, title: "Labor Costs & Workforce Economics", questionCount: 6 },
  ];
}

/** Maps wizard `moduleScores` keys (`module-1` … `module-7`) to display titles for a track. */
export function getDeepDiveModuleTitleForScoreKey(moduleScoreKey: string, track: BusinessTrack): string {
  const match = /^module-(\d+)$/.exec(moduleScoreKey);
  if (!match) return moduleScoreKey;
  const moduleIndex = Number(match[1]);
  if (!Number.isInteger(moduleIndex) || moduleIndex < 1 || moduleIndex > 7) return moduleScoreKey;
  const modules = getDeepDiveModules(track);
  const meta = modules.find((m) => m.moduleIndex === moduleIndex);
  return meta?.title ?? `Module ${String(moduleIndex)}`;
}

let choiceSerial = 0;

export function getDeepDiveQuestions(track: BusinessTrack): DeepDiveQuestion[] {
  choiceSerial = 0;
  const nextOffset = (n: number) => {
    const o = choiceSerial;
    choiceSerial += n;
    return o;
  };

  const m1 = buildQuestions(M1_PROMPTS, 1, MODULE_IDS.m1, "deep-m01", nextOffset(M1_PROMPTS.length));
  const m2 = buildQuestions(M2_PROMPTS, 2, MODULE_IDS.m2, "deep-m02", nextOffset(M2_PROMPTS.length));

  const m3Prompts = track === "healthcare" ? M3_HC_PROMPTS : M3_BS_PROMPTS;
  const m3Id = track === "healthcare" ? MODULE_IDS.m3hc : MODULE_IDS.m3bs;
  const m3Prefix = track === "healthcare" ? "deep-m03-hc" : "deep-m03-bs";
  const m3 = buildQuestions(m3Prompts, 3, m3Id, m3Prefix, nextOffset(m3Prompts.length));

  const m4 = buildQuestions(M4_PROMPTS, 4, MODULE_IDS.m4, "deep-m04", nextOffset(M4_PROMPTS.length));
  const m5 = buildQuestions(M5_PROMPTS, 5, MODULE_IDS.m5, "deep-m05", nextOffset(M5_PROMPTS.length));
  const m6 = buildQuestions(M6_PROMPTS, 6, MODULE_IDS.m6, "deep-m06", nextOffset(M6_PROMPTS.length));
  const m7 = buildQuestions(M7_PROMPTS, 7, MODULE_IDS.m7, "deep-m07", nextOffset(M7_PROMPTS.length));

  return [...m1, ...m2, ...m3, ...m4, ...m5, ...m6, ...m7];
}

export const DEEP_DIVE_QUESTION_COUNT = 44;
