-- ============================================================================
-- VEBOSSO EMS — Venues (024)
-- ============================================================================
-- Venues onboarded to VEBOSSO, one row per venue met. Anyone in the team can
-- add a venue and see the whole list (so two people don't pitch the same
-- place twice); only the owner can edit or delete.
--
-- Members cannot read each other's profiles, so the row carries the adder's
-- name, filled in by the database from added_by — never trusted from the app.
-- Safe to run repeatedly.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.venues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- The day the venue was met.
  met_on DATE NOT NULL DEFAULT CURRENT_DATE,
  venue_name TEXT NOT NULL,
  location TEXT,
  -- The person met at the venue.
  contact_role TEXT,
  contact_name TEXT,
  contact_email TEXT,
  added_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  added_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_venue_name CHECK (length(trim(venue_name)) BETWEEN 1 AND 200),
  CONSTRAINT chk_venue_location CHECK (location IS NULL OR length(location) <= 300),
  CONSTRAINT chk_venue_contact_role CHECK (contact_role IS NULL OR length(contact_role) <= 120),
  CONSTRAINT chk_venue_contact_name CHECK (contact_name IS NULL OR length(contact_name) <= 120),
  CONSTRAINT chk_venue_contact_email CHECK (
    contact_email IS NULL OR contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  CONSTRAINT chk_venue_met_on CHECK (met_on <= CURRENT_DATE + 1)
);

CREATE INDEX IF NOT EXISTS idx_venues_met_on ON public.venues(met_on DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_venues_added_by ON public.venues(added_by);
CREATE INDEX IF NOT EXISTS idx_venues_name_lower ON public.venues(lower(venue_name));

DROP TRIGGER IF EXISTS set_venues_updated_at ON public.venues;
CREATE TRIGGER set_venues_updated_at
  BEFORE UPDATE ON public.venues
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- The adder is whoever inserts the row (the owner may record for someone
-- else); the name always comes from their profile.
CREATE OR REPLACE FUNCTION public.set_venue_adder()
RETURNS TRIGGER AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT public.is_owner() OR NEW.added_by IS NULL THEN
      NEW.added_by := auth.uid();
    END IF;
  END IF;

  IF TG_OP = 'INSERT' OR NEW.added_by IS DISTINCT FROM OLD.added_by THEN
    SELECT full_name INTO NEW.added_by_name
    FROM public.profiles
    WHERE id = NEW.added_by;
  END IF;

  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_set_venue_adder ON public.venues;
CREATE TRIGGER trg_set_venue_adder
  BEFORE INSERT OR UPDATE ON public.venues
  FOR EACH ROW EXECUTE FUNCTION public.set_venue_adder();

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_all_venues" ON public.venues;
CREATE POLICY "owner_all_venues" ON public.venues
  FOR ALL TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "employees_read_venues" ON public.venues;
CREATE POLICY "employees_read_venues" ON public.venues
  FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('manager', 'member'));

DROP POLICY IF EXISTS "employees_add_venues" ON public.venues;
CREATE POLICY "employees_add_venues" ON public.venues
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('manager', 'member'));
-- No UPDATE / DELETE for non-owners.

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'venues'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.venues;
  END IF;
END;
$do$;
