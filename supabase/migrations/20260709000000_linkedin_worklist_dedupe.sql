-- LinkedIn worklist dedupe guard.
--
-- Invariant: a lead must never appear in the daily worklist on a day it already
-- received a message. Enforced at READ time (exclusion in a view), never as a
-- blocking trigger on crm_contacts.
--
-- Applied to project tbjynbevrhkfzpswehsj via the Supabase Management API on
-- 2026-07-09. Recorded here for reproducibility (schema otherwise lives only in
-- the dashboard for CRM tables).

-- Helper: convert an ISO-8601 timestamp text to the America/Denver calendar date.
-- Returns NULL for null/empty input. "Today" for this business is America/Denver.
CREATE OR REPLACE FUNCTION denver_date(ts text)
RETURNS date
LANGUAGE sql
STABLE
AS $func$
  SELECT CASE
    WHEN ts IS NULL OR ts = '' THEN NULL
    ELSE (ts::timestamptz AT TIME ZONE 'America/Denver')::date
  END
$func$;

-- Single source of truth for the LinkedIn daily worklist. Returns leads whose
-- sequence step is actionable (msg1/msg2/msg3) and due on/before the current
-- America/Denver day, EXCLUDING any lead that:
--   * already received a message today (msg1/2/3_sent_at on the Denver day),
--   * has replied (reply detection is terminal), or
--   * is awaiting fresh copy for a new round (needs_copy).
CREATE OR REPLACE VIEW linkedin_worklist AS
SELECT
  c.id,
  c.first_name,
  c.last_name,
  c.custom_fields,
  c.tags,
  (c.custom_fields->'linkedin'->>'sequence_step') AS sequence_step,
  (c.custom_fields->'linkedin'->>'sequence_due')  AS sequence_due
FROM crm_contacts c
WHERE c.custom_fields ? 'linkedin'
  AND (c.custom_fields->'linkedin'->>'sequence_step') IN ('msg1','msg2','msg3')
  AND (c.custom_fields->'linkedin'->>'sequence_due') IS NOT NULL
  AND (c.custom_fields->'linkedin'->>'sequence_due')::date
        <= (now() AT TIME ZONE 'America/Denver')::date
  AND COALESCE((c.custom_fields->'linkedin'->>'replied')::boolean, false) = false
  AND COALESCE((c.custom_fields->'linkedin'->>'needs_copy')::boolean, false) = false
  AND denver_date(c.custom_fields->'linkedin'->>'msg1_sent_at')
        IS DISTINCT FROM (now() AT TIME ZONE 'America/Denver')::date
  AND denver_date(c.custom_fields->'linkedin'->>'msg2_sent_at')
        IS DISTINCT FROM (now() AT TIME ZONE 'America/Denver')::date
  AND denver_date(c.custom_fields->'linkedin'->>'msg3_sent_at')
        IS DISTINCT FROM (now() AT TIME ZONE 'America/Denver')::date;

GRANT SELECT ON linkedin_worklist TO anon, authenticated, service_role;
