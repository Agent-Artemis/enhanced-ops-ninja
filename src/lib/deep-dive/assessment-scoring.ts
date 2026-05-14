import type { DeepDiveChoiceLetter } from "./assessment-data";

const POINTS: Record<DeepDiveChoiceLetter, number> = {
  A: 3,
  B: 2,
  C: 1,
  D: 0,
};

export function pointsForChoice(letter: DeepDiveChoiceLetter): number {
  return POINTS[letter];
}

export function moduleScorePercent(sumPoints: number, questionCount: number): number {
  const denom = 3 * questionCount;
  if (denom <= 0) return 0;
  return Math.round((sumPoints / denom) * 100);
}

export function overallScorePercent(totalPoints: number, totalQuestions: number): number {
  const denom = 3 * totalQuestions;
  if (denom <= 0) return 0;
  return Math.round((totalPoints / denom) * 100);
}
