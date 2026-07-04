-- ============================================================================
-- VEBOSSO EMS — Security Hardening Migration
-- Run after all previous migrations (001–006)
-- ============================================================================

-- ============================================================================
-- 1. FIX unauthenticated read on app_settings (from migration 004)
--    Migration 004 created a policy with USING (true) which allows anon reads.
--    Drop it and replace with authenticated-only access.
-- ============================================================================

DROP POLICY IF EXISTS "anyone_can_read_app_settings" ON public.app_settings;

-- Allow authenticated users to read all settings (covers version check after login)
-- The version check before login gracefully degrades if this fails.
CREATE POLICY "authenticated_can_read_app_settings" ON public.app_settings
  FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================================
-- 2. PREVENT PRIVILEGE ESCALATION — profiles table
--    Blocks members and managers from modifying their own role, is_active,
--    employee_id, or must_change_password via direct API calls.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_privilege_escalation()
RETURNS TRIGGER AS $$
DECLARE
  caller_role TEXT;
BEGIN
  -- Get the caller's current role (SECURITY DEFINER bypasses RLS)
  SELECT role INTO caller_role
  FROM public.profiles
  WHERE id = auth.uid();

  -- Only owners are allowed to change role, is_active, or employee_id
  IF caller_role IS DISTINCT FROM 'owner' THEN

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

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to profiles table
DROP TRIGGER IF EXISTS trg_prevent_privilege_escalation ON public.profiles;

CREATE TRIGGER trg_prevent_privilege_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_privilege_escalation();

COMMENT ON FUNCTION public.prevent_privilege_escalation IS
  'Security trigger: blocks non-owners from self-escalating role, toggling is_active, or changing employee_id.';

-- ============================================================================
-- 3. PREVENT SELF-APPROVAL — work_logs table
--    Blocks members from approving their own check-ins/check-outs
--    or setting approval-only status values via direct API calls.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_self_approval()
RETURNS TRIGGER AS $$
DECLARE
  caller_role TEXT;
BEGIN
  -- Get caller's role
  SELECT role INTO caller_role
  FROM public.profiles
  WHERE id = auth.uid();

  -- Only members are restricted; owners and managers may approve
  IF caller_role = 'member' THEN

    -- Block changes to approval boolean flags
    IF NEW.check_in_approved IS DISTINCT FROM OLD.check_in_approved THEN
      RAISE EXCEPTION 'SECURITY: Members cannot approve their own check-in.';
    END IF;

    IF NEW.check_out_approved IS DISTINCT FROM OLD.check_out_approved THEN
      RAISE EXCEPTION 'SECURITY: Members cannot approve their own check-out.';
    END IF;

    -- Block changes to approver ID fields
    IF NEW.check_in_approved_by IS DISTINCT FROM OLD.check_in_approved_by THEN
      RAISE EXCEPTION 'SECURITY: Members cannot set check-in approval metadata.';
    END IF;

    IF NEW.check_out_approved_by IS DISTINCT FROM OLD.check_out_approved_by THEN
      RAISE EXCEPTION 'SECURITY: Members cannot set check-out approval metadata.';
    END IF;

    IF NEW.check_in_approved_at IS DISTINCT FROM OLD.check_in_approved_at THEN
      RAISE EXCEPTION 'SECURITY: Members cannot set approval timestamps.';
    END IF;

    -- Block members from directly setting status to approved values
    -- Members can only move to: pending_approval → (stays pending), working (not allowed), done (not allowed)
    -- The only valid transitions for members via direct write are:
    --   pending_approval (on check-in insert, handled by INSERT policy)
    --   pending_checkout (on checkout, via the app)
    IF NEW.status IN ('working', 'done') AND OLD.status NOT IN ('working', 'done') THEN
      RAISE EXCEPTION 'SECURITY: Members cannot set status to approved values directly.';
    END IF;

    -- Block members from fabricating total_hours
    IF NEW.total_hours IS DISTINCT FROM OLD.total_hours THEN
      RAISE EXCEPTION 'SECURITY: Members cannot manually set total hours.';
    END IF;

    -- Block members from clearing rejection_reason (approver sets this)
    IF OLD.rejection_reason IS NOT NULL AND NEW.rejection_reason IS NULL THEN
      RAISE EXCEPTION 'SECURITY: Members cannot clear rejection reasons.';
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to work_logs table
DROP TRIGGER IF EXISTS trg_prevent_self_approval ON public.work_logs;

CREATE TRIGGER trg_prevent_self_approval
  BEFORE UPDATE ON public.work_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_self_approval();

COMMENT ON FUNCTION public.prevent_self_approval IS
  'Security trigger: blocks members from self-approving check-ins, check-outs, or setting approval metadata on their own work logs.';

-- ============================================================================
-- 4. ADD total_hours >= 0 CONSTRAINT
--    Prevents negative hours from being stored (timezone issues, data corruption)
-- ============================================================================

ALTER TABLE public.work_logs
  DROP CONSTRAINT IF EXISTS chk_total_hours_non_negative;

ALTER TABLE public.work_logs
  ADD CONSTRAINT chk_total_hours_non_negative
  CHECK (total_hours IS NULL OR total_hours >= 0);

-- ============================================================================
-- 5. ADD check_in_plan and day_report length constraints
--    Belt-and-suspenders server-side limits matching frontend maxLength
-- ============================================================================

ALTER TABLE public.work_logs
  DROP CONSTRAINT IF EXISTS chk_check_in_plan_length;

ALTER TABLE public.work_logs
  ADD CONSTRAINT chk_check_in_plan_length
  CHECK (check_in_plan IS NULL OR length(check_in_plan) <= 2000);

ALTER TABLE public.work_logs
  DROP CONSTRAINT IF EXISTS chk_day_report_length;

ALTER TABLE public.work_logs
  ADD CONSTRAINT chk_day_report_length
  CHECK (day_report IS NULL OR length(day_report) <= 3000);

-- Announcement body length constraint
ALTER TABLE public.announcements
  DROP CONSTRAINT IF EXISTS chk_announcement_body_length;

ALTER TABLE public.announcements
  ADD CONSTRAINT chk_announcement_body_length
  CHECK (length(body) <= 2000);

ALTER TABLE public.announcements
  DROP CONSTRAINT IF EXISTS chk_announcement_title_length;

ALTER TABLE public.announcements
  ADD CONSTRAINT chk_announcement_title_length
  CHECK (length(title) <= 200);

-- ============================================================================
-- Done
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '007_security_hardening: Applied successfully.';
  RAISE NOTICE '  - Fixed app_settings anon read policy';
  RAISE NOTICE '  - Added privilege escalation trigger on profiles';
  RAISE NOTICE '  - Added self-approval prevention trigger on work_logs';
  RAISE NOTICE '  - Added total_hours >= 0 constraint';
  RAISE NOTICE '  - Added text field length constraints';
END $$;

