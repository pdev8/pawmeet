-- ---------------------------------------------------------------------------
-- Schedule the hourly archival sweep with pg_cron.
--
-- archive_past_events() is intentionally not client-callable (execute revoked
-- from anon/authenticated), so it must run server-side. pg_cron is preloaded on
-- Supabase; this migration enables the extension and (re)schedules the job.
--
-- If `supabase db push` lacks the privilege to create the extension on your
-- project, enable it once in the dashboard (Database → Extensions → pg_cron),
-- then re-run this file's body in the SQL Editor. It is idempotent.
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;

-- Idempotent (re)schedule: drop a prior job of the same name, then schedule
-- the sweep at the top of every hour.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'archive-past-events') then
    perform cron.unschedule('archive-past-events');
  end if;

  perform cron.schedule(
    'archive-past-events',
    '0 * * * *',
    $cron$ select public.archive_past_events(); $cron$
  );
end $$;
