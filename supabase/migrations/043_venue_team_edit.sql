-- ============================================================================
-- VEBOSSO EMS — Venues: people with access can edit, delete and unmark (043)
--
-- Until now only the owner could edit or delete a venue, or take its
-- "in business" mark off (024, 029, 033). Anyone with Venues access can now
-- do all three. Removing a city stays owner-only. Who added a venue still
-- can't be changed by anyone but the owner.
-- ============================================================================

DROP POLICY IF EXISTS "venues_team_edit" ON public.venues;
CREATE POLICY "venues_team_edit" ON public.venues
  FOR UPDATE TO authenticated
  USING (public.has_feature('venues'))
  WITH CHECK (public.has_feature('venues'));

DROP POLICY IF EXISTS "venues_team_delete" ON public.venues;
CREATE POLICY "venues_team_delete" ON public.venues
  FOR DELETE TO authenticated
  USING (public.has_feature('venues'));

-- Same as 024, plus: only the owner can change who added a venue.
CREATE OR REPLACE FUNCTION public.set_venue_adder()
RETURNS TRIGGER AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT public.is_owner() OR NEW.added_by IS NULL THEN
      NEW.added_by := auth.uid();
    END IF;
  ELSIF NOT public.is_owner() THEN
    NEW.added_by := OLD.added_by;
  END IF;

  IF TG_OP = 'INSERT' OR NEW.added_by IS DISTINCT FROM OLD.added_by THEN
    SELECT full_name INTO NEW.added_by_name
    FROM public.profiles
    WHERE id = NEW.added_by;
  ELSE
    NEW.added_by_name := OLD.added_by_name;
  END IF;

  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- "In business" (033): anyone with Venues access can now mark and unmark.
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
  WHERE id = p_venue_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venue not found';
  END IF;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
