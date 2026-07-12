-- ============================================================================
-- VEBOSSO EMS — Schedule Daily Checkout Reminders
--   - Enables pg_cron extension (if not already enabled)
--   - Registers a daily cron job to run at 15:00 UTC (8:30 PM IST)
--   - Invokes the send-checkout-reminders Edge Function
-- ============================================================================

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove the cron job if it already exists to prevent duplicate schedules on migration re-runs
SELECT cron.unschedule('daily-checkout-reminder')
FROM cron.job
WHERE jobname = 'daily-checkout-reminder';

-- Schedule the daily checkout reminder cron job
-- Time: 15:00 UTC is exactly 20:30 (8:30 PM) IST
SELECT cron.schedule(
  'daily-checkout-reminder',
  '0 15 * * *',
  $$
  SELECT net.http_post(
    url := 'https://yfscjaednwpxadlkimyb.supabase.co/functions/v1/send-checkout-reminders',
    headers := '{"Content-Type": "application/json"}'
  );
  $$
);
