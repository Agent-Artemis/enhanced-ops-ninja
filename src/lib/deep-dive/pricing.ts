export const DEEP_DIVE_BASE_USD = 1500;

export type BusinessTrack = "healthcare" | "business";

export type AppliedPricing =
  | { kind: "base"; amountPaid: number }
  | { kind: "discount"; amountPaid: number; discountCode: string; summary: string }
  | { kind: "affiliate"; amountPaid: number; affiliate: string; summary: string };

export type ResolveCodeResult =
  | { ok: true; pricing: AppliedPricing }
  | { ok: false; message: string };

/**
 * Case-insensitive codes for checkout. 7SJM1 is affiliate-only (full price).
 */
export function resolveDiscountOrAffiliateCode(raw: string): ResolveCodeResult {
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
    case "7SJM1":
      return {
        ok: true,
        pricing: {
          kind: "affiliate",
          amountPaid: DEEP_DIVE_BASE_USD,
          affiliate: "7SJM1",
          summary: "Affiliate referral recorded — full price ($1,500 due today).",
        },
      };
    default:
      return { ok: false, message: "That code is not valid for this checkout." };
  }
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
