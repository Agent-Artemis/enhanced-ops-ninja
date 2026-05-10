import type { AssessmentConfig } from "@/lib/assessments/schema";

import { pointsForChoice } from "./points";

export type DomainScoreRow = {
  domainId: string;
  name: string;
  score: number;
  weight: number;
};

export type ComputedScores = {
  domainScores: DomainScoreRow[];
  overallScore: number;
  scoringVersion: "v1";
};

/**
 * Per-question contribution on a 0–100 scale (D=1 → 0%, A=5 → 100%).
 * Domain score is the unweighted mean of its questions; overall is a weighted mean of domain scores.
 */
export function computeScores(
  config: AssessmentConfig,
  answers: Record<string, string>,
): ComputedScores {
  const domainMeta = new Map(config.domains.map((d) => [d.id, d]));
  const normsByDomain = new Map<string, number[]>();

  for (const q of config.questions) {
    const choice = answers[q.id];
    if (!choice) {
      throw new Error(`Missing answer for question ${q.id}`);
    }
    const pts = pointsForChoice(choice);
    const normalized = ((pts - 1) / (5 - 1)) * 100;
    const list = normsByDomain.get(q.domainId) ?? [];
    list.push(normalized);
    normsByDomain.set(q.domainId, list);
  }

  const domainScores: DomainScoreRow[] = [];
  let weighted = 0;
  let wSum = 0;

  for (const [domainId, norms] of normsByDomain) {
    const meta = domainMeta.get(domainId);
    if (!meta) continue;
    const score = Math.round(norms.reduce((a, b) => a + b, 0) / norms.length);
    domainScores.push({
      domainId,
      name: meta.name,
      score,
      weight: meta.weight,
    });
    weighted += score * meta.weight;
    wSum += meta.weight;
  }

  domainScores.sort((a, b) => a.name.localeCompare(b.name));

  const overallScore = wSum > 0 ? Math.round(weighted / wSum) : 0;

  return { domainScores, overallScore, scoringVersion: "v1" };
}

export function scoreBand(overall: number): "green" | "yellow" | "orange" | "red" {
  if (overall >= 75) return "green";
  if (overall >= 55) return "yellow";
  if (overall >= 35) return "orange";
  return "red";
}
