import { IN_DEPTH_QUESTIONS } from "@/lib/in-depth-ops/questions";

export type FindingStatus = "RED" | "YELLOW" | "GREEN";

const byKey: Record<string, Record<FindingStatus, string>> = {};

for (const q of IN_DEPTH_QUESTIONS) {
  byKey[q.question_key] = {
    RED: `${q.module_name}: Low score on “${q.question_text}” — treat as a priority gap; likely amplifying cost and execution risk across adjacent workflows.`,
    YELLOW: `${q.module_name}: Mixed score on “${q.question_text}” — controls exist but are inconsistent; expect periodic surprises in reporting, cash, or customer experience.`,
    GREEN: `${q.module_name}: Strong score on “${q.question_text}” — this control is working; use it as a template to lift neighboring processes.`,
  };
}

export const FINDING_TEXT: Record<string, Partial<Record<FindingStatus, string>>> = byKey;
