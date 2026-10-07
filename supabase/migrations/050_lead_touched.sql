-- ============================================================================
-- VEBOSSO EMS — Navgrah Leads: new vs worked on (050)
-- ============================================================================
-- leads.touched_at is set the first time anyone does something with a lead:
-- calls it, WhatsApps it or saves it to their phone (the app sets it), or
-- edits its details (set here). Leads with no touched_at show as "New".
-- Moving a lead to another banquet doesn't count — nobody contacted it.
-- Safe to run repeatedly.
-- ============================================================================

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS touched_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.set_lead_touched()
RETURNS TRIGGER AS $fn$
BEGIN
  IF NEW.touched_at IS NULL AND (
       NEW.name IS DISTINCT FROM OLD.name
    OR NEW.dof IS DISTINCT FROM OLD.dof
    OR NEW.function IS DISTINCT FROM OLD.function
    OR NEW.contact IS DISTINCT FROM OLD.contact
    OR NEW.remarks IS DISTINCT FROM OLD.remarks
  ) THEN
    NEW.touched_at := now();
  END IF;
  -- Once worked on, a lead never goes back to new.
  IF OLD.touched_at IS NOT NULL AND NEW.touched_at IS NULL THEN
    NEW.touched_at := OLD.touched_at;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_set_lead_touched ON public.leads;
CREATE TRIGGER trg_set_lead_touched
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_lead_touched();
