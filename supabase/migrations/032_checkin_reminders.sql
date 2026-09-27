-- ============================================================================
-- VEBOSSO EMS — Daily check-in reminder (032)
-- ============================================================================
-- 1. profiles.sunday_checkin_reminder — each person can turn off the Sunday
--    check-in reminder in their settings. Default on.
-- 2. A daily pg_cron job at 06:00 UTC (11:30 AM IST) calls the
--    send-checkin-reminders Edge Function: everyone who hasn't checked in
--    yet gets a reminder (not on leave), and each owner gets an attendance
--    summary. On Sundays, only those who kept the Sunday setting on.
--
-- Deploy the function first:  supabase functions deploy send-checkin-reminders
-- Run after 031. Safe to run repeatedly.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sunday_checkin_reminder BOOLEAN NOT NULL DEFAULT true;

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule('daily-checkin-reminder')
FROM cron.job
WHERE jobname = 'daily-checkin-reminder';

-- 06:00 UTC is 11:30 AM IST.
SELECT cron.schedule(
  'daily-checkin-reminder',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://yfscjaednwpxadlkimyb.supabase.co/functions/v1/send-checkin-reminders',
    headers := '{"Content-Type": "application/json"}'
  );
  $$
);
