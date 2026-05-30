-- Idempotent: add unique indexes required by assessment upsert / ON CONFLICT targets.
-- Safe to run even if constraints already exist from assessment_core migration.

CREATE UNIQUE INDEX IF NOT EXISTS assessment_scores_session_id_uidx
  ON public.assessment_scores (session_id);

CREATE UNIQUE INDEX IF NOT EXISTS assessment_responses_session_question_uidx
  ON public.assessment_responses (session_id, question_id);
