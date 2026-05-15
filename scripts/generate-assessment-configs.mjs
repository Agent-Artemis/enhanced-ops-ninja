/**
 * Generates free-tier operational health assessment JSON configs.
 * Run: npm run generate:assessments
 *
 * paid-healthcare.json and paid-business.json are hand-maintained (Jeff's
 * in-depth voice content). This script does not overwrite them.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "config", "assessments");

/** @param {string} focus */
function maturityChoices(focus) {
  return [
    {
      key: "A",
      label: `Strong — ${focus}: clear owners, repeatable process, KPIs reviewed monthly, improving trend.`,
    },
    {
      key: "B",
      label: `Capable — ${focus}: works most of the time; gaps are known but not always prioritized.`,
    },
    {
      key: "C",
      label: `Emerging — ${focus}: inconsistent execution; limited measurement; frequent rework.`,
    },
    {
      key: "D",
      label: `At risk — ${focus}: unclear ownership, reactive firefighting, or material compliance/revenue exposure.`,
    },
  ];
}

/** @param {{id:string,domainId:string,prompt:string}[]} rows */
function withChoices(rows) {
  return rows.map((r) => ({
    id: r.id,
    domainId: r.domainId,
    prompt: r.prompt,
    choices: maturityChoices(r.focus ?? "this capability"),
  }));
}

const hcDomains = [
  { id: "patient_access", name: "Patient experience & access", weight: 1 },
  { id: "revenue_cycle", name: "Revenue cycle & financial operations", weight: 1 },
  { id: "clinical_ops", name: "Clinical & care delivery operations", weight: 1 },
  { id: "technology_data", name: "Technology, data & interoperability", weight: 1 },
  { id: "compliance_risk", name: "Compliance, privacy & risk", weight: 1 },
  { id: "workforce_ops", name: "Workforce, scheduling & workflow", weight: 1 },
];

const bizDomains = [
  { id: "customer_experience", name: "Customer experience & demand", weight: 1 },
  { id: "revenue_cash", name: "Revenue, billing & cash conversion", weight: 1 },
  { id: "operations_delivery", name: "Operations & service delivery", weight: 1 },
  { id: "technology_data", name: "Technology, data & integrations", weight: 1 },
  { id: "risk_governance", name: "Risk, governance & vendor management", weight: 1 },
  { id: "workforce_process", name: "Workforce, process & change readiness", weight: 1 },
];

const hcFreePrompts = [
  {
    id: "hc_f_01",
    domainId: "patient_access",
    focus: "scheduling and access",
    prompt:
      "How mature are your patient scheduling, reminders, and same-day access workflows (including no-show mitigation)?",
  },
  {
    id: "hc_f_02",
    domainId: "patient_access",
    focus: "intake and information capture",
    prompt:
      "How strong are your intake, eligibility, and pre-visit information capture processes before the clinician sees the patient?",
  },
  {
    id: "hc_f_03",
    domainId: "revenue_cycle",
    focus: "claims and denials",
    prompt:
      "How disciplined is your claims submission, denial management, and root-cause remediation cycle?",
  },
  {
    id: "hc_f_04",
    domainId: "revenue_cycle",
    focus: "patient collections",
    prompt:
      "How effective are patient responsibility estimates, payment plans, and proactive balance follow-up?",
  },
  {
    id: "hc_f_05",
    domainId: "clinical_ops",
    focus: "care pathways",
    prompt:
      "How standardized are clinical pathways, order sets, and documentation expectations across providers?",
  },
  {
    id: "hc_f_06",
    domainId: "clinical_ops",
    focus: "care coordination",
    prompt:
      "How reliably do referrals, care transitions, and closed-loop communications execute without manual chasing?",
  },
  {
    id: "hc_f_07",
    domainId: "technology_data",
    focus: "systems and data quality",
    prompt:
      "How trustworthy is your core clinical/billing data (duplicates, interfaces, and source-of-truth discipline)?",
  },
  {
    id: "hc_f_08",
    domainId: "technology_data",
    focus: "automation and integrations",
    prompt:
      "How automated are high-volume workflows between EHR, PM, labs, imaging, and patient communications?",
  },
  {
    id: "hc_f_09",
    domainId: "compliance_risk",
    focus: "HIPAA and security",
    prompt:
      "How mature are HIPAA safeguards, access controls, audit readiness, and workforce security training?",
  },
  {
    id: "hc_f_10",
    domainId: "compliance_risk",
    focus: "policy and monitoring",
    prompt:
      "How current are policies/procedures, BAAs, incident response drills, and privacy monitoring?",
  },
  {
    id: "hc_f_11",
    domainId: "workforce_ops",
    focus: "staffing and coverage",
    prompt:
      "How predictable are staffing, coverage, and float plans relative to demand and acuity?",
  },
  {
    id: "hc_f_12",
    domainId: "workforce_ops",
    focus: "training and productivity",
    prompt:
      "How strong are role-based training, competency checks, and productivity metrics for front/back office teams?",
  },
  {
    id: "hc_f_13",
    domainId: "revenue_cycle",
    focus: "AR and cash acceleration",
    prompt:
      "How tight are AR aging workflows, payer follow-ups, and cash posting timeliness?",
  },
  {
    id: "hc_f_14",
    domainId: "patient_access",
    focus: "communication and engagement",
    prompt:
      "How consistent are outbound patient communications (appointments, instructions, surveys) across channels?",
  },
  {
    id: "hc_f_15",
    domainId: "technology_data",
    focus: "reporting and visibility",
    prompt:
      "How actionable are operational dashboards for leaders (access, revenue, quality, risk) without manual spreadsheet work?",
  },
];

const bizFreePrompts = [
  {
    id: "gb_f_01",
    domainId: "customer_experience",
    focus: "lead response and routing",
    prompt:
      "How fast and consistent is lead capture, qualification, and routing to the right owner?",
  },
  {
    id: "gb_f_02",
    domainId: "customer_experience",
    focus: "onboarding and retention",
    prompt:
      "How standardized are onboarding, success checkpoints, and renewal/expansion motions?",
  },
  {
    id: "gb_f_03",
    domainId: "revenue_cash",
    focus: "quote-to-cash",
    prompt:
      "How reliable is quote-to-cash (pricing approvals, contracts, invoicing, and revenue recognition handoffs)?",
  },
  {
    id: "gb_f_04",
    domainId: "revenue_cash",
    focus: "collections",
    prompt:
      "How proactive are collections, dunning, and dispute resolution before cash stalls?",
  },
  {
    id: "gb_f_05",
    domainId: "operations_delivery",
    focus: "delivery and SLAs",
    prompt:
      "How predictable is service delivery against SLAs, capacity plans, and backlog management?",
  },
  {
    id: "gb_f_06",
    domainId: "operations_delivery",
    focus: "supplier and fulfillment",
    prompt:
      "How resilient are procurement, vendor performance management, and fulfillment exception handling?",
  },
  {
    id: "gb_f_07",
    domainId: "technology_data",
    focus: "data quality",
    prompt:
      "How trustworthy is operational/customer data across CRM, billing, and product systems?",
  },
  {
    id: "gb_f_08",
    domainId: "technology_data",
    focus: "integrations and automation",
    prompt:
      "How automated are cross-system workflows (billing, support, marketing, finance) versus manual swivel-chair work?",
  },
  {
    id: "gb_f_09",
    domainId: "risk_governance",
    focus: "controls and audits",
    prompt:
      "How mature are internal controls, access reviews, and audit evidence collection?",
  },
  {
    id: "gb_f_10",
    domainId: "risk_governance",
    focus: "security and resilience",
    prompt:
      "How prepared are you for security incidents, backups, DR testing, and vendor concentration risk?",
  },
  {
    id: "gb_f_11",
    domainId: "workforce_process",
    focus: "process documentation",
    prompt:
      "How current are SOPs, playbooks, and decision rights for critical operational processes?",
  },
  {
    id: "gb_f_12",
    domainId: "workforce_process",
    focus: "change and training",
    prompt:
      "How effective is training, change management, and adoption measurement when new tools or processes launch?",
  },
  {
    id: "gb_f_13",
    domainId: "customer_experience",
    focus: "support and quality",
    prompt:
      "How disciplined are support tiers, QA sampling, and feedback loops into product/ops improvements?",
  },
  {
    id: "gb_f_14",
    domainId: "revenue_cash",
    focus: "forecasting",
    prompt:
      "How credible is forecasting (pipeline hygiene, forecast governance, and variance reviews)?",
  },
  {
    id: "gb_f_15",
    domainId: "operations_delivery",
    focus: "continuous improvement",
    prompt:
      "How institutionalized are retrospectives, KPI reviews, and improvement backlogs tied to owners and dates?",
  },
];

function writeJson(name, obj) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, name), `${JSON.stringify(obj, null, 2)}\n`, "utf8");
}

const freeHealthcare = {
  schemaVersion: 1,
  tier: "free",
  track: "healthcare",
  domains: hcDomains,
  questions: withChoices(hcFreePrompts),
};

const freeBusiness = {
  schemaVersion: 1,
  tier: "free",
  track: "business",
  domains: bizDomains,
  questions: withChoices(bizFreePrompts),
};

writeJson("free-healthcare.json", freeHealthcare);
writeJson("free-business.json", freeBusiness);

const counts = {
  freeHealthcare: freeHealthcare.questions.length,
  freeBusiness: freeBusiness.questions.length,
};

console.log("Wrote free assessment configs:", counts);
console.log(
  "Skipped paid-healthcare.json and paid-business.json (hand-maintained in-depth content).",
);
