-- ============================================================================
-- VEBOSSO EMS — Check in again after a check-in is sent back (048)
-- ============================================================================
-- Sending a check-in back marks that day's work log 'rejected' and keeps it.
-- There is one log per person per day, so checking in again tried to add a
-- second one and failed ("duplicate key"). The person can't reset the old one
-- themselves either: prevent_self_approval (018) stops them clearing the
-- approver, the time and the reason.
--
-- redo_check_in() resets today's sent-back log to a fresh, unapproved
-- check-in, on the caller's behalf only. Like submit_backfill() (018) it lets
-- its own write past the trigger with a transaction-local flag, which can't be
-- set from the app (set_config is not exposed over the API).
-- Safe to run repeatedly.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.redo_check_in(
  p_date DATE,
  p_plan TEXT,
  p_photos TEXT[] DEFAULT NULL
)
RETURNS public.work_logs AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_log public.work_logs;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  -- Same window as a normal check-in (018): today, give or take the gap
  -- between the phone's date and the server's UTC date.
  IF p_date < CURRENT_DATE - 1 OR p_date > CURRENT_DATE + 1 THEN
    RAISE EXCEPTION 'You can only check in for today.';
  END IF;

  IF p_plan IS NOT NULL AND length(p_plan) > 2000 THEN
    RAISE EXCEPTION 'The plan is too long.';
  END IF;

  SELECT * INTO v_log
  FROM public.work_logs
  WHERE user_id = v_user_id AND date = p_date
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'There is no check-in for that day to redo.';
  END IF;

  IF v_log.status <> 'rejected' THEN
    RAISE EXCEPTION 'You have already checked in today.';
  END IF;

  PERFORM set_config('vebosso.backfill_authorized', 'on', true);

  UPDATE public.work_logs
  SET status = 'pending_approval',
      check_in_time = now(),
      check_in_plan = p_plan,
      check_in_photos = p_photos,
      check_in_approved = false,
      check_in_approved_by = NULL,
      check_in_approved_at = NULL,
      rejection_reason = NULL,
      check_out_time = NULL,
      day_report = NULL,
      check_out_photos = '{}',
      check_out_approved = false,
      check_out_approved_by = NULL,
      total_hours = NULL
  WHERE id = v_log.id
  RETURNING * INTO v_log;

  PERFORM set_config('vebosso.backfill_authorized', 'off', true);

  RETURN v_log;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.redo_check_in(DATE, TEXT, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redo_check_in(DATE, TEXT, TEXT[]) TO authenticated;
