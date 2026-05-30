import type { SupabaseClient } from "@supabase/supabase-js";

function isDuplicateKeyError(code: string | undefined): boolean {
  return code === "23505";
}

type ScorePayload = {
  session_id: string;
  domain_scores: Record<string, number>;
  overall_score: number;
  scoring_version: string;
  computed_at: string;
};

/** Plain INSERT; on duplicate session_id, UPDATE the existing row. */
export async function saveAssessmentScore(
  admin: SupabaseClient,
  payload: ScorePayload,
): Promise<{ error: { message: string; code?: string } | null }> {
  const { error } = await admin.from("assessment_scores").insert(payload);

  if (!error) return { error: null };

  if (isDuplicateKeyError(error.code)) {
    const { error: updateError } = await admin
      .from("assessment_scores")
      .update({
        domain_scores: payload.domain_scores,
        overall_score: payload.overall_score,
        scoring_version: payload.scoring_version,
        computed_at: payload.computed_at,
      })
      .eq("session_id", payload.session_id);

    return updateError
      ? { error: { message: updateError.message, code: updateError.code } }
      : { error: null };
  }

  return { error: { message: error.message, code: error.code } };
}

type ResponsePayload = {
  session_id: string;
  question_id: string;
  choice_key: string;
  points: number;
};

/** Plain INSERT; on duplicate (session_id, question_id), UPDATE the answer. */
export async function saveAssessmentResponse(
  admin: SupabaseClient,
  payload: ResponsePayload,
): Promise<{ error: { message: string; code?: string } | null }> {
  const { error } = await admin.from("assessment_responses").insert(payload);

  if (!error) return { error: null };

  if (isDuplicateKeyError(error.code)) {
    const { error: updateError } = await admin
      .from("assessment_responses")
      .update({
        choice_key: payload.choice_key,
        points: payload.points,
      })
      .eq("session_id", payload.session_id)
      .eq("question_id", payload.question_id);

    return updateError
      ? { error: { message: updateError.message, code: updateError.code } }
      : { error: null };
  }

  return { error: { message: error.message, code: error.code } };
}
