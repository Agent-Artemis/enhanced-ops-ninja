import type { SupabaseClient } from "@supabase/supabase-js";
import { NURTURE_SCHEDULE_DAYS, type NurtureStep } from "./nurture-templates";

const STEPS: NurtureStep[] = [0, 1, 2, 3];

/**
 * Enqueue all nurture steps for a newly-completed free assessment.
 * Uses INSERT ... ON CONFLICT DO NOTHING so re-completions are idempotent.
 */
export async function enqueueNurtureSequence(
  admin: SupabaseClient,
  params: {
    email: string;
    firstName: string;
    sessionId: string;
    completedAt: Date;
  },
) {
  const rows = STEPS.map((step) => {
    const d = new Date(params.completedAt);
    d.setDate(d.getDate() + NURTURE_SCHEDULE_DAYS[step]);
    return {
      email: params.email,
      first_name: params.firstName,
      session_id: params.sessionId,
      sequence: "free_assessment",
      step,
      scheduled_at: d.toISOString(),
    };
  });

  const { error } = await admin
    .from("nurture_queue")
    .upsert(rows, { onConflict: "email,sequence,step", ignoreDuplicates: true });

  if (error) {
    console.error("[enqueue-nurture] upsert failed:", error.message);
  }
}
