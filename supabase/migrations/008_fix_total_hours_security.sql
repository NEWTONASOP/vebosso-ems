-- ============================================================================
-- Migration 008: Fix total_hours Security Trigger
-- ============================================================================
-- Issue: The security trigger prevents members from updating total_hours,
--        but the compute_total_hours trigger automatically sets it during checkout.
--        This causes checkout to fail with "Members cannot manually set total hours."
--
-- Fix: Allow total_hours to change when check_out_time is being set (auto-compute)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_self_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Only apply restrictions to members
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'member' THEN
    
    -- Block members from approving their own check-ins
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
    IF NEW.status IN ('working', 'done') AND OLD.status NOT IN ('working', 'done') THEN
      RAISE EXCEPTION 'SECURITY: Members cannot set status to approved values directly.';
    END IF;

    -- Block members from fabricating total_hours
    -- EXCEPTION: Allow it to change when check_out_time is being set (auto-computed by trigger)
    IF NEW.total_hours IS DISTINCT FROM OLD.total_hours THEN
      -- If check_out_time is changing, it's being auto-computed by compute_total_hours trigger
      IF NEW.check_out_time IS NOT DISTINCT FROM OLD.check_out_time THEN
        RAISE EXCEPTION 'SECURITY: Members cannot manually set total hours.';
      END IF;
    END IF;

    -- Block members from clearing rejection_reason (approver sets this)
    IF OLD.rejection_reason IS NOT NULL AND NEW.rejection_reason IS NULL THEN
      RAISE EXCEPTION 'SECURITY: Members cannot clear rejection reasons.';
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Log completion
-- ============================================================================
DO $$ 
BEGIN
  RAISE NOTICE '✅ Migration 008 completed: Fixed total_hours security trigger';
  RAISE NOTICE '  - Members can now checkout without "cannot manually set total hours" error';
  RAISE NOTICE '  - Security maintained: manual total_hours changes still blocked';
END $$;
