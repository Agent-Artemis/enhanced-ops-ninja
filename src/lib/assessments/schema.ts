import { z } from "zod";

export const assessmentTierSchema = z.enum(["free", "paid"]);
export const assessmentTrackSchema = z.enum(["healthcare", "business"]);

export const choiceSchema = z.object({
  key: z.enum(["A", "B", "C", "D"]),
  label: z.string().min(1),
});

export const domainSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Relative weight when rolling up to overall score (default 1). */
  weight: z.number().positive().default(1),
});

export const questionSchema = z.object({
  id: z.string().min(1),
  domainId: z.string().min(1),
  prompt: z.string().min(1),
  choices: z.array(choiceSchema).length(4),
});

export const assessmentConfigSchema = z.object({
  schemaVersion: z.literal(1),
  tier: assessmentTierSchema,
  track: assessmentTrackSchema,
  domains: z.array(domainSchema).min(1),
  questions: z.array(questionSchema).min(1),
});

export type AssessmentConfig = z.infer<typeof assessmentConfigSchema>;
export type AssessmentQuestion = z.infer<typeof questionSchema>;
export type AssessmentDomain = z.infer<typeof domainSchema>;
