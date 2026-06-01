/**
 * Deep dive assessment localStorage keys.
 * Checkout writes `deepDiveAssessmentId` on payment success; this module is the single source of truth.
 */
export const DEEP_DIVE_LS = {
  assessmentId: "deepDiveAssessmentId",
  /** Same values as `BusinessTrack` in pricing.ts */
  businessType: "businessType",
  email: "deepDiveEmail",
  firstName: "deepDiveFirstName",
  overallScore: "deepDiveOverallScore",
  moduleScores: "deepDiveModuleScores",
  answers: "deepDiveAnswers",
} as const;

export type StoredBusinessType = "healthcare" | "business";

/** Returns real browser Storage or null (SSR, broken polyfills, tests). Never throws. */
function getBrowserLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    const ls = window.localStorage;
    if (ls == null) return null;
    if (typeof ls.getItem !== "function" || typeof ls.setItem !== "function") return null;
    return ls;
  } catch {
    return null;
  }
}

export function readLocalStorage(key: string): string | null {
  const ls = getBrowserLocalStorage();
  if (!ls) return null;
  try {
    return ls.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocalStorageIfEmpty(key: string, value: string): void {
  const ls = getBrowserLocalStorage();
  if (!ls) return;
  try {
    if (ls.getItem(key) == null || ls.getItem(key) === "") {
      ls.setItem(key, value);
    }
  } catch {
    // quota / private mode
  }
}

export function writeLocalStorage(key: string, value: string): void {
  const ls = getBrowserLocalStorage();
  if (!ls) return;
  try {
    ls.setItem(key, value);
  } catch {
    // non-fatal
  }
}

export function parseBusinessType(raw: string | null): StoredBusinessType | null {
  if (raw === "healthcare" || raw === "business") return raw;
  return null;
}
