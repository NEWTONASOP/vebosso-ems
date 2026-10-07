-- ============================================================================
-- VEBOSSO EMS — Venues: everyone sees only the venues they added (051)
-- ============================================================================
-- Until now everyone with Venues access saw every venue (033), and could
-- edit, delete and mark them (043). Now:
--   • A person with Venues access sees, edits, deletes and marks / unmarks
--     only the venues they added themselves (venues.added_by — recorded on
--     every venue since 024, so existing venues stay with whoever added them).
--   • The owner sees and does everything, as before (owner_all_venues, 024).
--   • Cities stay one shared list: everyone sees all of them and can add
--     one; only the owner removes one (033).
--   • Two people may onboard the same place — each keeps their own.
-- Supersedes the venue policies of 033 and 043. Safe to run repeatedly.
-- ============================================================================

DROP POLICY IF EXISTS "venues_team_read" ON public.venues;
DROP POLICY IF EXISTS "venues_team_add" ON public.venues;
DROP POLICY IF EXISTS "venues_team_edit" ON public.venues;
DROP POLICY IF EXISTS "venues_team_delete" ON public.venues;
DROP POLICY IF EXISTS "venues_own_read" ON public.venues;
DROP POLICY IF EXISTS "venues_own_add" ON public.venues;
DROP POLICY IF EXISTS "venues_own_edit" ON public.venues;
DROP POLICY IF EXISTS "venues_own_delete" ON public.venues;

CREATE POLICY "venues_own_read" ON public.venues
  FOR SELECT TO authenticated
  USING (public.has_feature('venues') AND added_by = auth.uid());

-- The adder is always the signed-in person (set_venue_adder, 024).
CREATE POLICY "venues_own_add" ON public.venues
  FOR INSERT TO authenticated
  WITH CHECK (public.has_feature('venues'));

CREATE POLICY "venues_own_edit" ON public.venues
  FOR UPDATE TO authenticated
  USING (public.has_feature('venues') AND added_by = auth.uid())
  WITH CHECK (public.has_feature('venues') AND added_by = auth.uid());

CREATE POLICY "venues_own_delete" ON public.venues
  FOR DELETE TO authenticated
  USING (public.has_feature('venues') AND added_by = auth.uid());

-- "In business" (043): own venues only, unless you're the owner.
CREATE OR REPLACE FUNCTION public.set_venue_in_business(p_venue_id UUID, p_value BOOLEAN)
RETURNS VOID AS $fn$
DECLARE
  v_name TEXT;
BEGIN
  IF NOT public.has_feature('venues') THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT full_name INTO v_name FROM public.profiles WHERE id = auth.uid();

  UPDATE public.venues
  SET in_business = p_value,
      in_business_by_name = CASE WHEN p_value THEN v_name END,
      in_business_at = CASE WHEN p_value THEN now() END
  WHERE id = p_venue_id
    AND (public.is_owner() OR added_by = auth.uid());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venue not found';
  END IF;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
