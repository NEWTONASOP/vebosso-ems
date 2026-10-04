-- ============================================================================
-- VEBOSSO EMS — "Will be paid by" date on salary and travel expense requests (041)
-- ============================================================================
-- The owner can tell someone when their salary or travel expense will be
-- cleared. It is set from the owner's side only; the person sees it on their
-- request. Nothing else about the requests changes.
-- Safe to run repeatedly.
-- ============================================================================

ALTER TABLE public.salary_requests ADD COLUMN IF NOT EXISTS expected_on DATE;
ALTER TABLE public.expense_claims ADD COLUMN IF NOT EXISTS expected_on DATE;

-- Only the owner may set or change it. (Employees can touch their own salary
-- request in a few ways — a reminder, confirming receipt — and must not be
-- able to write a date through those.)
CREATE OR REPLACE FUNCTION public.guard_expected_on()
RETURNS TRIGGER AS $fn$
BEGIN
  IF auth.uid() IS NULL OR public.is_owner() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.expected_on := NULL;
  ELSIF NEW.expected_on IS DISTINCT FROM OLD.expected_on THEN
    RAISE EXCEPTION 'Only the owner can set the pay date';
  END IF;

  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_guard_salary_expected_on ON public.salary_requests;
CREATE TRIGGER trg_guard_salary_expected_on
  BEFORE INSERT OR UPDATE ON public.salary_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_expected_on();

DROP TRIGGER IF EXISTS trg_guard_expense_expected_on ON public.expense_claims;
CREATE TRIGGER trg_guard_expense_expected_on
  BEFORE INSERT OR UPDATE ON public.expense_claims
  FOR EACH ROW EXECUTE FUNCTION public.guard_expected_on();
