-- ============================================================================
-- VEBOSSO EMS — Venues: owner's toggle for sharing (052)
-- ============================================================================
-- One switch in owner Settings, stored as app_settings 'venues_shared':
--   'false' (default) — each person sees and works on only the venues they
--                       added (051).
--   'true'            — like before: everyone with Venues access sees every
--                       venue and can edit, delete and mark / unmark them.
-- The owner always sees and does everything. Cities are unchanged (one
-- shared list). Run after 051. Safe to run repeatedly.
-- ============================================================================

INSERT INTO public.app_settings (key, value)
VALUES ('venues_shared', 'false')
ON CONFLICT (key) DO NOTHING;

-- Is the owner sharing everyone's venues with everyone? SECURITY DEFINER so it
-- doesn't depend on who may read app_settings.
CREATE OR REPLACE FUNCTION public.venues_shared()
RETURNS BOOLEAN AS $fn$
  SELECT coalesce((SELECT value = 'true' FROM public.app_settings WHERE key = 'venues_shared'), false);
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.venues_shared() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.venues_shared() TO authenticated;

-- Can the signed-in person work on a venue added by p_added_by?
CREATE OR REPLACE FUNCTION public.can_use_venue(p_added_by UUID)
RETURNS BOOLEAN AS $fn$
  SELECT public.has_feature('venues') AND (p_added_by = auth.uid() OR public.venues_shared());
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.can_use_venue(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_use_venue(UUID) TO authenticated;

DROP POLICY IF EXISTS "venues_own_read" ON public.venues;
DROP POLICY IF EXISTS "venues_own_edit" ON public.venues;
DROP POLICY IF EXISTS "venues_own_delete" ON public.venues;

CREATE POLICY "venues_own_read" ON public.venues
  FOR SELECT TO authenticated
  USING (public.can_use_venue(added_by));

CREATE POLICY "venues_own_edit" ON public.venues
  FOR UPDATE TO authenticated
  USING (public.can_use_venue(added_by))
  WITH CHECK (public.can_use_venue(added_by));

CREATE POLICY "venues_own_delete" ON public.venues
  FOR DELETE TO authenticated
  USING (public.can_use_venue(added_by));

-- "In business": same rule.
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
    AND (public.is_owner() OR public.can_use_venue(added_by));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venue not found';
  END IF;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
