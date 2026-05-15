import { MODULE_CONFIG } from "@/lib/ops-report/scoring";

export type AssessmentTrack = "healthcare" | "general_business";

export interface InDepthQuestion {
  question_key: string;
  module_number: number;
  module_name: string;
  question_number: number;
  question_text: string;
}

const MODULE_PROMPTS: Record<number, string[]> = {
  1: [
    "How consistently do you track gross margin by product or service line?",
    "Typical days from invoice to cash in bank for your core customers?",
    "How well documented and communicated is your break-even target?",
    "How often does leadership review a full financial statement package?",
    "Where does operating margin typically land relative to plan?",
    "Do you maintain a rolling 90-day cash flow forecast?",
    "Is P&L broken out by segment (service line, location, or payer class)?",
  ],
  2: [
    "Is current staffing clearly right-sized for workload and quality targets?",
    "When someone calls out, how reliable is same-day coverage?",
    "Roughly what share of the owner’s week is proactive leadership vs. firefighting?",
    "What best describes your annualized voluntary turnover?",
    "How structured and repeatable is onboarding for new hires?",
    "Do you run a documented retention strategy (not only exit interviews)?",
    "Are core HR policies and handbook current and accessible to staff?",
  ],
  3: [
    "How standardized are payment terms across customers or payers?",
    "What share of invoices are paid on time without follow-up?",
    "Typical days sales outstanding (DSO) for your receivables?",
    "What share of AR is older than 90 days?",
    "Is there a documented collections cadence owners actually follow?",
    "How formal is your invoice dispute resolution process?",
    "Do you offer structured payment plans when appropriate?",
    "What is your annual bad debt write-off as a percent of AR?",
  ],
  4: [
    "What share of routine admin work is still manual vs. automated?",
    "Does the team use a shared task or work management system daily?",
    "How are inbound customer requests triaged and tracked to completion?",
    "How visible is your new business pipeline from lead to close?",
    "Have you evaluated or deployed AI tools for operations in the last 12 months?",
    "Do you maintain SOPs for your top recurring operational tasks?",
  ],
  5: [
    "What best describes your primary phone / communications platform?",
    "What share of inbound calls are answered live during business hours?",
    "Are scripted call guides used for common inbound scenarios?",
    "How are after-hours and overflow calls handled today?",
    "Are call analytics (answer rate, abandon, hold) reviewed monthly?",
  ],
  6: [
    "Is your org chart current and reflected in how work actually flows?",
    "Does every role have an up-to-date job description?",
    "Could the business operate for a week without the owner in daily decisions?",
    "How much do leaders trust operational data when making calls?",
    "How concentrated is revenue across customers, payers, or referrers?",
  ],
  7: [
    "Total labor cost as a percent of revenue — where are you?",
    "Is revenue per FTE tracked and reviewed at least quarterly?",
    "How planned and controlled is overtime relative to budgets?",
    "When did you last benchmark wages for your top roles externally?",
    "Do you track cost-to-hire and time-to-fill for key positions?",
    "Have you modeled what a 10% labor efficiency gain would mean financially?",
  ],
  8: [
    "How strong is your digital presence for the buyers you actually want?",
    "Is there an active, measured referral system (not just informal word of mouth)?",
    "Is paid acquisition running with clear ROI guardrails?",
    "Does your website capture leads with a clear next step?",
    "Are new leads followed up within 24 hours with a defined process?",
    "Do you know acquisition source for the majority of new revenue?",
    "How actively do you collect and showcase reviews / proof?",
    "When did you last complete a structured marketing audit?",
  ],
};

function buildQuestions(): InDepthQuestion[] {
  const out: InDepthQuestion[] = [];
  for (const mod of MODULE_CONFIG) {
    const prompts = MODULE_PROMPTS[mod.number];
    if (!prompts || prompts.length !== mod.maxQuestions) {
      throw new Error(`MODULE_PROMPTS mismatch for module ${mod.number}`);
    }
    for (let i = 0; i < mod.maxQuestions; i += 1) {
      const question_number = i + 1;
      const question_key = `M${mod.number}_Q${question_number}`;
      out.push({
        question_key,
        module_number: mod.number,
        module_name: mod.name,
        question_number,
        question_text: prompts[i] ?? "",
      });
    }
  }
  return out;
}

export const IN_DEPTH_QUESTIONS: readonly InDepthQuestion[] = buildQuestions();

export function getQuestionByKey(key: string): InDepthQuestion | undefined {
  return IN_DEPTH_QUESTIONS.find((q) => q.question_key === key);
}
