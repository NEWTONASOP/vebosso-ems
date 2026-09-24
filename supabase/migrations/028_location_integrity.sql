-- ============================================================================
-- VEBOSSO EMS — Location integrity (028)
-- ============================================================================
-- Bug: the app stamped every fix with the day of the check-in, not the day it
-- was recorded. If someone never checked out, tracking kept going and fixes
-- from the following days were filed under the old day — one "stop" could
-- read "Stayed 57h".
--
-- Fix, independent of which app version sends the fix:
--   * A fix belongs to its `date` only if it was recorded between 00:00 that
--     day and 08:00 the next morning (late events run past midnight). Anything
--     else is re-dated to the day it was actually recorded and detached from
--     the old work log.
--   * Existing rows are repaired the same way, once.
--
-- Times are India time (Asia/Kolkata) — every employee works in India.
-- Safe to run repeatedly.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.location_ping_local_ts(p_recorded_at TIMESTAMPTZ)
RETURNS TIMESTAMP
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT p_recorded_at AT TIME ZONE 'Asia/Kolkata';
$fn$;

/** True when a fix recorded at p_recorded_at may be filed under p_date. */
CREATE OR REPLACE FUNCTION public.location_ping_fits_date(p_date DATE, p_recorded_at TIMESTAMPTZ)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT public.location_ping_local_ts(p_recorded_at) >= p_date::timestamp
     AND public.location_ping_local_ts(p_recorded_at) <  p_date::timestamp + INTERVAL '32 hours';
$fn$;

CREATE OR REPLACE FUNCTION public.fix_location_ping_date()
RETURNS TRIGGER AS $fn$
BEGIN
  IF NEW.date IS NULL OR NOT public.location_ping_fits_date(NEW.date, NEW.recorded_at) THEN
    NEW.date := public.location_ping_local_ts(NEW.recorded_at)::date;
    -- The check-in it was attached to is a different day now.
    NEW.work_log_id := NULL;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_fix_location_ping_date ON public.location_pings;
CREATE TRIGGER trg_fix_location_ping_date
  BEFORE INSERT OR UPDATE OF date, recorded_at ON public.location_pings
  FOR EACH ROW EXECUTE FUNCTION public.fix_location_ping_date();

-- Repair what is already stored.
UPDATE public.location_pings
SET date = public.location_ping_local_ts(recorded_at)::date,
    work_log_id = NULL
WHERE NOT public.location_ping_fits_date(date, recorded_at);
