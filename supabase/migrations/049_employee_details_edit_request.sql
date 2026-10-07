-- ============================================================================
-- VEBOSSO EMS — Employee details: ask to edit again (049)
-- ============================================================================
-- After submitting (045) the person can only read their details. Now they
-- can ask to edit them: the owner approves, the person edits once, and it
-- locks again when they save.
--   edit_requested_at — the person asked (null = no request open)
--   edit_unlocked     — the owner approved; cleared by the person's next save
-- The person can't unlock it themselves: the trigger forces it off for them.
-- Safe to run repeatedly.
-- ============================================================================

ALTER TABLE public.employee_details ADD COLUMN IF NOT EXISTS edit_requested_at TIMESTAMPTZ;
ALTER TABLE public.employee_details ADD COLUMN IF NOT EXISTS edit_unlocked BOOLEAN NOT NULL DEFAULT false;

-- Same as 045, plus the request / unlock rules for everyone but the owner.
CREATE OR REPLACE FUNCTION public.set_employee_details_editor()
RETURNS TRIGGER AS $fn$
BEGIN
  NEW.updated_by := auth.uid();
  IF TG_OP = 'UPDATE' THEN
    NEW.submitted_at := OLD.submitted_at;
  ELSIF NOT public.is_owner() THEN
    NEW.submitted_at := now();
  END IF;

  IF NOT public.is_owner() THEN
    IF TG_OP = 'INSERT' THEN
      NEW.edit_unlocked := false;
      NEW.edit_requested_at := NULL;
    ELSIF coalesce(current_setting('vebosso.details_request', true), '') = 'on' THEN
      -- request_details_edit(): only the request time changes.
      NEW.edit_unlocked := OLD.edit_unlocked;
    ELSE
      -- Their one approved edit: saved, so it locks again.
      NEW.edit_unlocked := false;
      NEW.edit_requested_at := NULL;
      NEW.submitted_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- The person may update their own details only while the owner has unlocked them.
DROP POLICY IF EXISTS "employee_details_edit_own_unlocked" ON public.employee_details;
CREATE POLICY "employee_details_edit_own_unlocked" ON public.employee_details
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND edit_unlocked)
  WITH CHECK (user_id = auth.uid());

-- The person asks to edit (they have no update rights while locked).
CREATE OR REPLACE FUNCTION public.request_details_edit()
RETURNS VOID AS $fn$
DECLARE
  v_rows INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  PERFORM set_config('vebosso.details_request', 'on', true);
  UPDATE public.employee_details
  SET edit_requested_at = now()
  WHERE user_id = auth.uid() AND NOT edit_unlocked;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  PERFORM set_config('vebosso.details_request', 'off', true);

  IF v_rows = 0 THEN
    RAISE EXCEPTION 'Nothing to ask about — fill in your details first, or you can already edit them.';
  END IF;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.request_details_edit() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_details_edit() TO authenticated;
