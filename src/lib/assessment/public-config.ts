import type { AssessmentConfig } from "@/lib/assessments/schema";

export type PublicAssessmentPayload = {
  track: AssessmentConfig["track"];
  tier: AssessmentConfig["tier"];
  questionCount: number;
  domains: Array<{ id: string; name: string; weight: number }>;
  questions: Array<{
    id: string;
    domainId: string;
    type: "multiple_choice" | "open";
    prompt: string;
    choices: Array<{ key: "A" | "B" | "C" | "D"; label: string }>;
  }>;
};

export function toPublicAssessmentPayload(config: AssessmentConfig): PublicAssessmentPayload {
  return {
    track: config.track,
    tier: config.tier,
    questionCount: config.questions.length,
    domains: config.domains.map((d) => ({
      id: d.id,
      name: d.name,
      weight: d.weight,
    })),
    questions: config.questions.map((q) => ({
      id: q.id,
      domainId: q.domainId,
      type: q.type,
      prompt: q.prompt,
      choices: q.choices,
    })),
  };
}
