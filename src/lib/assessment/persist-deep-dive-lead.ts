import type { SupabaseClient } from "@supabase/supabase-js";

export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "" };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") };
}

/** Map free-assessment track to a human-readable business_type label. */
export function businessTypeFromTrack(track: string | null | undefined): string {
  if (track === "healthcare") return "Healthcare";
  if (track === "business") return "General Business";
  return "General Business";
}

type PersistFreeDeepDiveLeadParams = {
  fullName: string;
  email: string;
  track: string | null | undefined;
  answers: Record<string, string>;
  overallScore: number;
};

/**
 * Inserts a free-assessment completion row into deep_dive_assessments.
 * Uses the Supabase service-role client passed in (bypasses RLS).
 */
export async function persistFreeDeepDiveLead(
  admin: SupabaseClient,
  params: PersistFreeDeepDiveLeadParams,
) {
  const { firstName, lastName } = splitFullName(params.fullName);
  const createdAt = new Date().toISOString();

  const row = {
    first_name: firstName,
    last_name: lastName,
    email: params.email,
    phone: "",
    org_name: "",
    business_type: businessTypeFromTrack(params.track),
    amount_paid: 0,
    assessment_answers: params.answers,
    assessment_score: params.overallScore,
    created_at: createdAt,
  };

  return admin.from("deep_dive_assessments").insert(row).select("id").single();
}
