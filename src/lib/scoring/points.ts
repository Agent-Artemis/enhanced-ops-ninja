export type LetterChoice = "A" | "B" | "C" | "D";

/** Operational maturity: A strongest (5) → D weakest (1). No value of 2 on this scale. */
export const LETTER_POINTS: Record<LetterChoice, number> = {
  A: 5,
  B: 4,
  C: 3,
  D: 1,
};

export function pointsForChoice(key: string): number {
  if (key === "A" || key === "B" || key === "C" || key === "D") {
    return LETTER_POINTS[key];
  }
  throw new Error(`Invalid choice key: ${key}`);
}
