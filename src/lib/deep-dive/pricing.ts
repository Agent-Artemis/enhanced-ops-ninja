export const DEEP_DIVE_BASE_USD = 1500;

export type BusinessTrack = "healthcare" | "business";

/** Checkout price is driven only by discount codes; affiliate is metadata-only. */
export type AppliedPricing =
  | { kind: "base"; amountPaid: number }
  | { kind: "discount"; amountPaid: number; discountCode: string; summary: string };

export type ResolveDiscountResult =
  | { ok: true; pricing: AppliedPricing }
  | { ok: false; message: string };

export type ResolveAffiliateResult =
  | { ok: true; affiliate: string; message: string }
  | { ok: false; message: string };

/** Explicit affiliates we recognize by name (case-insensitive). Extend as partners onboard. */
export const KNOWN_AFFILIATE_CODES = ["7SJM1"] as const;

const DISCOUNT_CODE_SET = new Set<string>(["PILOT10", "SILENTNINJA20", "TESTER4", "MASTERTEST"]);

/** Normalized (uppercase trim) string is one of the fixed discount codes. */
export function isDiscountCode(normalized: string): boolean {
  return DISCOUNT_CODE_SET.has(normalized);
}

/**
 * Whether `raw` should be accepted as an affiliate referral code for checkout.
 * Rules: never a discount code; matches KNOWN_AFFILIATE_CODES; OR matches
 * `^[A-Z0-9]{5}$` so future 5-character partner codes work without a deploy.
 * (Documented here so product can widen the pattern later if needed.)
 */
export function isAffiliateCode(raw: string): boolean {
  const normalized = raw.trim().toUpperCase();
  if (!normalized) return false;
  if (isDiscountCode(normalized)) return false;
  if (KNOWN_AFFILIATE_CODES.some((c) => c.toUpperCase() === normalized)) return true;
  return /^[A-Z0-9]{5}$/.test(normalized);
}

export function resolveDiscountCode(raw: string): ResolveDiscountResult {
  const normalized = raw.trim().toUpperCase();
  if (!normalized) {
    return { ok: false, message: "Enter a code to apply." };
  }

  switch (normalized) {
    case "PILOT10":
      return {
        ok: true,
        pricing: {
          kind: "discount",
          amountPaid: 1000,
          discountCode: "PILOT10",
          summary: "Pilot pricing: $500 off ($1,000 due today).",
        },
      };
    case "SILENTNINJA20":
      return {
        ok: true,
        pricing: {
          kind: "discount",
          amountPaid: 1200,
          discountCode: "SILENTNINJA20",
          summary: "20% off base price ($1,200 due today).",
        },
      };
    case "TESTER4":
      return {
        ok: true,
        pricing: {
          kind: "discount",
          amountPaid: 1,
          discountCode: "TESTER4",
          summary: "Test checkout: $1 due today.",
        },
      };
    case "MASTERTEST":
      return {
        ok: true,
        pricing: {
          kind: "discount",
          amountPaid: 0,
          discountCode: "MASTERTEST",
          summary: "Internal test bypass: $0 due today.",
        },
      };
    default:
      return { ok: false, message: "That discount code is not valid for this checkout." };
  }
}

export function resolveAffiliateCode(raw: string): ResolveAffiliateResult {
  const normalized = raw.trim().toUpperCase();
  if (!normalized) {
    return { ok: false, message: "Enter a code to apply." };
  }
  if (!isAffiliateCode(raw)) {
    return { ok: false, message: "That affiliate code is not valid for this checkout." };
  }
  return {
    ok: true,
    affiliate: normalized,
    message: "Affiliate referral recorded — price is unchanged.",
  };
}

export function basePricing(): AppliedPricing {
  return { kind: "base", amountPaid: DEEP_DIVE_BASE_USD };
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
