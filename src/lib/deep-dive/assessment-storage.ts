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
} as const;

export type StoredBusinessType = "healthcare" | "business";

export function readLocalStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocalStorageIfEmpty(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(key) == null || window.localStorage.getItem(key) === "") {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // quota / private mode
  }
}

export function writeLocalStorage(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // non-fatal
  }
}

export function parseBusinessType(raw: string | null): StoredBusinessType | null {
  if (raw === "healthcare" || raw === "business") return raw;
  return null;
}
