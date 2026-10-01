-- ============================================================================
-- VEBOSSO EMS — New members stuck on "Change your password"
-- ============================================================================
-- complete_password_change() (018) clears profiles.must_change_password, but
-- the prevent_privilege_escalation trigger rejects that change for every
-- non-owner — including when it comes from this function, because auth.uid()
-- is still the member inside a SECURITY DEFINER function. So for a member or
-- manager the flag never cleared: the password did change, the flag stayed
-- true, and the app sent them back to the change-password screen.
--
-- The function now raises a transaction-local marker just before the update,
-- and the trigger lets the change through only when that marker is set. A
-- client cannot set it: it only lives for the transaction that runs this
-- function, and the function checks that the password really changed first.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_privilege_escalation()
RETURNS TRIGGER AS $$
DECLARE
  caller_role TEXT;
BEGIN
  SELECT role INTO caller_role
  FROM public.profiles
  WHERE id = auth.uid();

  -- Owners may change anything. Service-role callers (Edge Functions) have no
  -- auth.uid() and no profile row, so caller_role is NULL — treat them as
  -- trusted, since they already hold the service key.
  IF caller_role IS NULL OR caller_role = 'owner' THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'SECURITY: You are not allowed to change your own role. Contact your administrator.';
  END IF;

  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'SECURITY: You are not allowed to change your account active status. Contact your administrator.';
  END IF;

  IF NEW.employee_id IS DISTINCT FROM OLD.employee_id THEN
    RAISE EXCEPTION 'SECURITY: You are not allowed to change your employee ID. Contact your administrator.';
  END IF;

  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'SECURITY: You are not allowed to change the creator field.';
  END IF;

  IF NEW.manager_id IS DISTINCT FROM OLD.manager_id THEN
    RAISE EXCEPTION 'SECURITY: You are not allowed to change who manages you. Contact your administrator.';
  END IF;

  -- Clearing the forced-password-change flag must go through
  -- public.complete_password_change(), which verifies the password really
  -- changed and sets the marker below. Only turning it off is allowed.
  IF NEW.must_change_password IS DISTINCT FROM OLD.must_change_password THEN
    IF NOT (
      COALESCE(current_setting('app.password_change_ok', true), '') = 'on'
      AND NEW.must_change_password = false
    ) THEN
      RAISE EXCEPTION 'SECURITY: must_change_password cannot be set directly. Use complete_password_change().';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.complete_password_change()
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_changed_at TIMESTAMPTZ;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT updated_at INTO v_changed_at
  FROM auth.users
  WHERE id = v_user_id;

  IF v_changed_at IS NULL OR v_changed_at < now() - INTERVAL '5 minutes' THEN
    RAISE EXCEPTION 'No recent password change detected. Change your password first.';
  END IF;

  -- Transaction-local (third argument true): gone when this call finishes.
  PERFORM set_config('app.password_change_ok', 'on', true);

  UPDATE public.profiles
  SET must_change_password = false
  WHERE id = v_user_id;

  PERFORM set_config('app.password_change_ok', 'off', true);

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION public.complete_password_change() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_password_change() TO authenticated;
