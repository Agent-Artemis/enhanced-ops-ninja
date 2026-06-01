import paidBusinessConfig from "@config/assessments/paid-business.json";
import paidHealthcareConfig from "@config/assessments/paid-healthcare.json";

import { assessmentConfigSchema, type AssessmentConfig } from "@/lib/assessments/schema";
import type { BusinessTrack } from "@/lib/deep-dive/pricing";

export type DeepDiveChoiceLetter = "A" | "B" | "C" | "D";

export type DeepDiveChoiceMap = Record<DeepDiveChoiceLetter, string>;

export type DeepDiveQuestionType = "multiple_choice" | "open";

export type DeepDiveQuestion = {
  id: string;
  moduleId: string;
  moduleIndex: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  type: DeepDiveQuestionType;
  prompt: string;
  choices: DeepDiveChoiceMap;
};

export type DeepDiveModuleMeta = {
  id: string;
  moduleIndex: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  title: string;
  questionCount: number;
};

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

const DOMAIN_MODULE_IDS: Record<string, string> = {
  financials_revenue: MODULE_IDS.m1,
  staffing_hr: MODULE_IDS.m2,
  billing_rcm: MODULE_IDS.m3hc,
  ar_collections: MODULE_IDS.m3bs,
  automation: MODULE_IDS.m4,
  phone_comms: MODULE_IDS.m5,
  org_structure: MODULE_IDS.m6,
  labor_costs: MODULE_IDS.m7,
};

const CONFIG_BY_TRACK: Record<BusinessTrack, AssessmentConfig> = {
  healthcare: assessmentConfigSchema.parse(paidHealthcareConfig),
  business: assessmentConfigSchema.parse(paidBusinessConfig),
};

function choicesFromConfig(
  choices: AssessmentConfig["questions"][number]["choices"],
): DeepDiveChoiceMap {
  const map = {} as DeepDiveChoiceMap;
  for (const c of choices) {
    map[c.key] = c.label;
  }
  return map;
}

function questionsFromConfig(config: AssessmentConfig): DeepDiveQuestion[] {
  return config.questions.map((q) => {
    const domainIndex = config.domains.findIndex((d) => d.id === q.domainId);
    if (domainIndex < 0) {
      throw new Error(`Unknown domainId "${q.domainId}" in deep-dive assessment config`);
    }
    const moduleIndex = (domainIndex + 1) as DeepDiveQuestion["moduleIndex"];
    const moduleId = DOMAIN_MODULE_IDS[q.domainId] ?? q.domainId;
    return {
      id: q.id,
      moduleId,
      moduleIndex,
      type: q.type,
      prompt: q.prompt,
      choices: choicesFromConfig(q.choices),
    };
  });
}

export function getDeepDiveModules(track: BusinessTrack): DeepDiveModuleMeta[] {
  const config = CONFIG_BY_TRACK[track];
  return config.domains.map((d, i) => ({
    id: DOMAIN_MODULE_IDS[d.id] ?? d.id,
    moduleIndex: (i + 1) as DeepDiveModuleMeta["moduleIndex"],
    title: d.name,
    questionCount: config.questions.filter((q) => q.domainId === d.id).length,
  }));
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

export function getDeepDiveQuestions(track: BusinessTrack): DeepDiveQuestion[] {
  return questionsFromConfig(CONFIG_BY_TRACK[track]);
}

export function getDeepDiveQuestionCount(track: BusinessTrack): number {
  return CONFIG_BY_TRACK[track].questions.length;
}

/** @deprecated Use getDeepDiveQuestionCount(track) — healthcare has 45 questions. */
export const DEEP_DIVE_QUESTION_COUNT = 45;
