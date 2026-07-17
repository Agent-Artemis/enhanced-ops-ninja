-- Referrals tally column on the Daily Activity Log.
--
-- Tracks how many referrals come in on a given day. Referrals sit at the TOP of
-- the funnel (a referral arrives → it gets called), so the Reports UI renders
-- this column first, ahead of Phone Calls.
--
-- Additive and non-breaking: existing rows backfill to 0 via the default, and
-- every other column is untouched.
--
-- NOTE: `crm_daily_activity` is one of the older CRM tables whose schema was
-- created in the Supabase dashboard and never captured in a migration file (see
-- CLAUDE.md — "No migration files for these tables"). It therefore does not
-- exist on a from-scratch `supabase db reset`. The guard below makes this
-- migration a no-op in that case instead of hard-failing the whole run; against
-- the live database, where the table does exist, the column is added normally.

do $$
begin
  if to_regclass('public.crm_daily_activity') is null then
    raise notice 'crm_daily_activity does not exist — skipping referrals column';
  else
    alter table public.crm_daily_activity
      add column if not exists referrals integer not null default 0;
  end if;
end
$$;
