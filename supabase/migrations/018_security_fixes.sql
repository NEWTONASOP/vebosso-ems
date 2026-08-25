-- ============================================================================
-- VEBOSSO EMS — Security Fixes (018)
-- ============================================================================
-- Closes four exploitable holes that only need the public anon key to abuse:
--
--   1. prevent_self_approval only ran BEFORE UPDATE, so a member could INSERT a
--      work log that was already "approved", for any date they liked.
--   2. Backfill authorisation was enforced only in the client, and the
--      "mark permission as used" write silently no-opped under RLS, so a single
--      grant could be replayed forever.
--   3. prevent_privilege_escalation did not cover manager_id or
--      must_change_password, letting a member pick their own approver and skip
--      the forced password rotation.
--   4. Migration 008 replaced prevent_self_approval and dropped the
--      check_in_approved / check_out_approved guards that 007 had. Restored.
--
-- Safe to run repeatedly and in any prior schema state (IF EXISTS / OR REPLACE).
-- ============================================================================


-- ============================================================================
-- 0. Backfill escape hatch
-- ============================================================================
-- The backfill RPC below legitimately needs to write a back-dated, already
-- completed work log on a member's behalf. It flags that by setting a
-- transaction-local GUC which the triggers honour. Members cannot set this
-- themselves: set_config lives in pg_catalog and is not exposed over PostgREST,
-- and the flag is transaction-scoped, so it cannot be carried between requests.

CREATE OR REPLACE FUNCTION public.is_authorized_backfill()
RETURNS BOOLEAN AS $$
  SELECT coalesce(current_setting('vebosso.backfill_authorized', true), '') = 'on';
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION public.is_authorized_backfill IS
  'True only inside public.submit_backfill(), which sets a transaction-local GUC.';


-- ============================================================================
-- 1. Privilege escalation guard — add manager_id and must_change_password
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

  -- NEW: choosing your own approver is a privilege change.
  IF NEW.manager_id IS DISTINCT FROM OLD.manager_id THEN
    RAISE EXCEPTION 'SECURITY: You are not allowed to change who manages you. Contact your administrator.';
  END IF;

  -- NEW: clearing the forced-password-change flag must go through
  -- public.complete_password_change(), which verifies the password really changed.
  IF NEW.must_change_password IS DISTINCT FROM OLD.must_change_password THEN
    RAISE EXCEPTION 'SECURITY: must_change_password cannot be set directly. Use complete_password_change().';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_privilege_escalation ON public.profiles;

CREATE TRIGGER trg_prevent_privilege_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_privilege_escalation();

COMMENT ON FUNCTION public.prevent_privilege_escalation IS
  'Security trigger: blocks non-owners from changing role, is_active, employee_id, created_by, manager_id, or must_change_password.';


-- ============================================================================
-- 2. Legitimate way to clear must_change_password
-- ============================================================================
-- The app calls this straight after supabase.auth.updateUser({ password }).
-- We confirm GoTrue actually touched the account moments ago before clearing
-- the flag, so it cannot be used to skip the rotation.

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

  UPDATE public.profiles
  SET must_change_password = false
  WHERE id = v_user_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION public.complete_password_change() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_password_change() TO authenticated;


-- ============================================================================
-- 3. Work log forgery guard — now covers INSERT as well as UPDATE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_self_approval()
RETURNS TRIGGER AS $$
DECLARE
  caller_role TEXT;
BEGIN
  -- Authorised backfills are written by public.submit_backfill() on the
  -- member's behalf and are allowed to be back-dated and pre-completed.
  IF public.is_authorized_backfill() THEN
    RETURN NEW;
  END IF;

  SELECT role INTO caller_role
  FROM public.profiles
  WHERE id = auth.uid();

  -- Owners and service-role callers are unrestricted.
  IF caller_role IS NULL OR caller_role = 'owner' THEN
    RETURN NEW;
  END IF;

  -- ---------------------------------------------------------------------
  -- INSERT: a fresh log may only ever be an unapproved check-in for today.
  -- Applies to members AND managers — both check in through the same screen,
  -- and neither has any legitimate reason to insert a pre-approved row.
  -- ---------------------------------------------------------------------
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'pending_approval' THEN
      RAISE EXCEPTION 'SECURITY: A new work log must start as pending_approval.';
    END IF;

    IF NEW.check_in_approved OR NEW.check_out_approved THEN
      RAISE EXCEPTION 'SECURITY: You cannot create a pre-approved work log.';
    END IF;

    IF NEW.check_in_approved_by IS NOT NULL
       OR NEW.check_out_approved_by IS NOT NULL
       OR NEW.check_in_approved_at IS NOT NULL THEN
      RAISE EXCEPTION 'SECURITY: You cannot set approval metadata on a new work log.';
    END IF;

    IF NEW.check_out_time IS NOT NULL OR NEW.day_report IS NOT NULL THEN
      RAISE EXCEPTION 'SECURITY: You cannot check out in the same write as checking in.';
    END IF;

    IF NEW.total_hours IS NOT NULL THEN
      RAISE EXCEPTION 'SECURITY: total_hours is computed by the server.';
    END IF;

    IF NEW.rejection_reason IS NOT NULL THEN
      RAISE EXCEPTION 'SECURITY: You cannot set a rejection reason.';
    END IF;

    -- Back-dating must go through the backfill flow. A one-day window either
    -- side absorbs the gap between the device's local date and the server's
    -- UTC date (a 00:30 IST check-in is still 19:00 UTC the previous day).
    IF NEW.date < CURRENT_DATE - 1 OR NEW.date > CURRENT_DATE + 1 THEN
      RAISE EXCEPTION 'SECURITY: You can only check in for today. Ask an owner to grant a backfill for past dates.';
    END IF;

    RETURN NEW;
  END IF;

  -- ---------------------------------------------------------------------
  -- UPDATE: members may progress their own day but never approve it.
  -- Managers keep their existing ability to approve (unchanged behaviour).
  -- ---------------------------------------------------------------------
  IF caller_role = 'member' THEN

    -- Restored from 007 — migration 008 dropped these two checks.
    IF NEW.check_in_approved IS DISTINCT FROM OLD.check_in_approved THEN
      RAISE EXCEPTION 'SECURITY: Members cannot approve their own check-in.';
    END IF;

    IF NEW.check_out_approved IS DISTINCT FROM OLD.check_out_approved THEN
      RAISE EXCEPTION 'SECURITY: Members cannot approve their own check-out.';
    END IF;

    IF NEW.check_in_approved_by IS DISTINCT FROM OLD.check_in_approved_by THEN
      RAISE EXCEPTION 'SECURITY: Members cannot set check-in approval metadata.';
    END IF;

    IF NEW.check_out_approved_by IS DISTINCT FROM OLD.check_out_approved_by THEN
      RAISE EXCEPTION 'SECURITY: Members cannot set check-out approval metadata.';
    END IF;

    IF NEW.check_in_approved_at IS DISTINCT FROM OLD.check_in_approved_at THEN
      RAISE EXCEPTION 'SECURITY: Members cannot set approval timestamps.';
    END IF;

    IF NEW.status IN ('working', 'done') AND OLD.status NOT IN ('working', 'done') THEN
      RAISE EXCEPTION 'SECURITY: Members cannot set status to approved values directly.';
    END IF;

    -- Moving the day to another date sidesteps the insert-time date window.
    IF NEW.date IS DISTINCT FROM OLD.date THEN
      RAISE EXCEPTION 'SECURITY: Members cannot change the date of a work log.';
    END IF;

    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'SECURITY: Members cannot reassign a work log.';
    END IF;

    -- total_hours is recomputed by compute_total_hours whenever check_out_time
    -- moves; allow it only in that case (kept from 008).
    IF NEW.total_hours IS DISTINCT FROM OLD.total_hours
       AND NEW.check_out_time IS NOT DISTINCT FROM OLD.check_out_time THEN
      RAISE EXCEPTION 'SECURITY: Members cannot manually set total hours.';
    END IF;

    IF OLD.rejection_reason IS NOT NULL AND NEW.rejection_reason IS NULL THEN
      RAISE EXCEPTION 'SECURITY: Members cannot clear rejection reasons.';
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_self_approval ON public.work_logs;

CREATE TRIGGER trg_prevent_self_approval
  BEFORE INSERT OR UPDATE ON public.work_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_self_approval();

COMMENT ON FUNCTION public.prevent_self_approval IS
  'Security trigger: blocks forged work logs on INSERT (pre-approved or back-dated) and self-approval on UPDATE.';


-- ============================================================================
-- 4. Matching WITH CHECK on the insert policies (defence in depth)
-- ============================================================================
-- The trigger above is the real enforcement; these make the intent visible in
-- the policy itself and stop the row before the trigger even runs.

DROP POLICY IF EXISTS "member_insert_own_work_logs" ON public.work_logs;

CREATE POLICY "member_insert_own_work_logs" ON public.work_logs
  FOR INSERT WITH CHECK (
    public.get_user_role() = 'member'
    AND user_id = auth.uid()
    AND status = 'pending_approval'
    AND check_in_approved = false
    AND check_out_approved = false
    AND check_in_approved_by IS NULL
    AND check_out_approved_by IS NULL
    AND check_in_approved_at IS NULL
    AND total_hours IS NULL
  );

DROP POLICY IF EXISTS "manager_insert_own_work_logs" ON public.work_logs;

CREATE POLICY "manager_insert_own_work_logs" ON public.work_logs
  FOR INSERT WITH CHECK (
    public.get_user_role() = 'manager'
    AND user_id = auth.uid()
    AND status = 'pending_approval'
    AND check_in_approved = false
    AND check_out_approved = false
    AND check_in_approved_by IS NULL
    AND check_out_approved_by IS NULL
    AND check_in_approved_at IS NULL
    AND total_hours IS NULL
  );

-- UPDATE policies gain a WITH CHECK so a row cannot be updated *out* of the
-- caller's own scope (USING alone only gates which rows are visible to update).
DROP POLICY IF EXISTS "member_update_own_work_logs" ON public.work_logs;

CREATE POLICY "member_update_own_work_logs" ON public.work_logs
  FOR UPDATE
  USING (public.get_user_role() = 'member' AND user_id = auth.uid())
  WITH CHECK (public.get_user_role() = 'member' AND user_id = auth.uid());

DROP POLICY IF EXISTS "manager_update_team_work_logs" ON public.work_logs;

CREATE POLICY "manager_update_team_work_logs" ON public.work_logs
  FOR UPDATE
  USING (
    public.get_user_role() = 'manager'
    AND (user_id = auth.uid() OR public.is_manager_of(user_id))
  )
  WITH CHECK (
    public.get_user_role() = 'manager'
    AND (user_id = auth.uid() OR public.is_manager_of(user_id))
  );

DROP POLICY IF EXISTS "member_update_own_profile" ON public.profiles;

CREATE POLICY "member_update_own_profile" ON public.profiles
  FOR UPDATE
  USING (public.get_user_role() = 'member' AND id = auth.uid())
  WITH CHECK (public.get_user_role() = 'member' AND id = auth.uid());

DROP POLICY IF EXISTS "manager_update_own_profile" ON public.profiles;

CREATE POLICY "manager_update_own_profile" ON public.profiles
  FOR UPDATE
  USING (public.get_user_role() = 'manager' AND id = auth.uid())
  WITH CHECK (public.get_user_role() = 'manager' AND id = auth.uid());


-- ============================================================================
-- 5. Server-side backfill — validates and consumes the permission atomically
-- ============================================================================

CREATE OR REPLACE FUNCTION public.submit_backfill(
  p_date DATE,
  p_check_in_time TIMESTAMPTZ,
  p_check_in_plan TEXT,
  p_check_out_time TIMESTAMPTZ,
  p_day_report TEXT
)
RETURNS public.work_logs AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_permission_id UUID;
  v_require_approval BOOLEAN;
  v_status TEXT;
  v_log public.work_logs;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_check_in_time IS NULL OR p_check_out_time IS NULL THEN
    RAISE EXCEPTION 'Check-in and check-out times are required.';
  END IF;

  IF p_check_out_time <= p_check_in_time THEN
    RAISE EXCEPTION 'Check-out time must be after check-in time.';
  END IF;

  IF p_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'You cannot backfill a future date.';
  END IF;

  -- Claim the permission. FOR UPDATE serialises concurrent attempts so the same
  -- grant cannot be spent twice by two parallel requests.
  SELECT id INTO v_permission_id
  FROM public.backfill_permissions
  WHERE user_id = v_user_id
    AND date = p_date
    AND is_used = false
  FOR UPDATE;

  IF v_permission_id IS NULL THEN
    RAISE EXCEPTION 'You are not authorized by the owner to backfill this date.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Trust the server's copy of the setting, not the client's.
  SELECT value = 'true' INTO v_require_approval
  FROM public.app_settings
  WHERE key = 'require_checkout_approval';

  v_status := CASE WHEN coalesce(v_require_approval, false)
                   THEN 'pending_checkout' ELSE 'done' END;

  -- Tell the guard triggers this write is sanctioned (transaction-local).
  PERFORM set_config('vebosso.backfill_authorized', 'on', true);

  INSERT INTO public.work_logs (
    user_id, date, check_in_time, check_in_plan,
    check_out_time, day_report, status
  )
  VALUES (
    v_user_id, p_date, p_check_in_time, p_check_in_plan,
    p_check_out_time, p_day_report, v_status
  )
  ON CONFLICT (user_id, date) DO UPDATE SET
    check_in_time  = EXCLUDED.check_in_time,
    check_in_plan  = EXCLUDED.check_in_plan,
    check_out_time = EXCLUDED.check_out_time,
    day_report     = EXCLUDED.day_report,
    status         = EXCLUDED.status,
    updated_at     = now()
  RETURNING * INTO v_log;

  -- Consume the permission. This runs as the function owner, so unlike the old
  -- client-side update it is not silently swallowed by RLS.
  UPDATE public.backfill_permissions
  SET is_used = true
  WHERE id = v_permission_id;

  PERFORM set_config('vebosso.backfill_authorized', 'off', true);

  RETURN v_log;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.submit_backfill(DATE, TIMESTAMPTZ, TEXT, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_backfill(DATE, TIMESTAMPTZ, TEXT, TIMESTAMPTZ, TEXT) TO authenticated;

COMMENT ON FUNCTION public.submit_backfill IS
  'Validates and consumes a backfill_permissions grant, then writes the back-dated work log, in one transaction.';


-- ============================================================================
-- Done
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '018_security_fixes: Applied successfully.';
  RAISE NOTICE '  - prevent_self_approval now runs on INSERT as well as UPDATE';
  RAISE NOTICE '  - restored check_in_approved / check_out_approved guards dropped by 008';
  RAISE NOTICE '  - manager_id and must_change_password added to escalation guard';
  RAISE NOTICE '  - added complete_password_change() RPC';
  RAISE NOTICE '  - added submit_backfill() RPC (atomic permission consumption)';
  RAISE NOTICE '  - added WITH CHECK to work_logs / profiles insert+update policies';
END $$;
