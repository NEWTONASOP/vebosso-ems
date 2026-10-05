-- ============================================================================
-- VEBOSSO EMS — Navgrah Leads: who added each lead (047)
-- ============================================================================
-- leads.created_by (042) already records who added a lead. Not everyone can
-- read everyone's profile, so the name is kept on the lead too, filled in by
-- the database (like venues.added_by_name, 024). Existing leads get theirs
-- now. Safe to run repeatedly.
-- ============================================================================

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS created_by_name TEXT;

-- The adder is always the signed-in person; the name comes from their profile.
CREATE OR REPLACE FUNCTION public.set_lead_adder()
RETURNS TRIGGER AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
  ELSE
    NEW.created_by := OLD.created_by;
  END IF;

  IF TG_OP = 'INSERT' OR NEW.created_by IS DISTINCT FROM OLD.created_by OR OLD.created_by_name IS NULL THEN
    SELECT full_name INTO NEW.created_by_name FROM public.profiles WHERE id = NEW.created_by;
  ELSE
    NEW.created_by_name := OLD.created_by_name;
  END IF;

  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_set_lead_adder ON public.leads;
CREATE TRIGGER trg_set_lead_adder
  BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_lead_adder();

-- Leads added so far.
UPDATE public.leads l
SET created_by_name = p.full_name
FROM public.profiles p
WHERE p.id = l.created_by AND l.created_by_name IS NULL;
