-- ============================================================================
-- VEBOSSO EMS — Several people per venue (040)
-- ============================================================================
-- A venue used to hold one "person met" (contact_role / name / phone / email).
-- Now it holds a list, `contacts`:
--   [{ "role": "Manager", "name": "Ravi", "phone": "98…", "email": "r@…" }, …]
-- Existing venues get their one person as the first entry.
--
-- The old columns stay, always holding a copy of the first person, so app
-- versions from before this change still show and save something sensible:
--   * an old app adding a venue (contact_* only) → it becomes the first person;
--   * an old app editing contact_* → the first person is updated;
--   * the new app saves `contacts` → contact_* are copied from the first one.
-- Cities can already be removed by the owner (033); venues in a removed city
-- simply have no city (ON DELETE SET NULL).
-- Safe to run repeatedly.
-- ============================================================================

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS contacts JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.venues DROP CONSTRAINT IF EXISTS chk_venue_contacts;
ALTER TABLE public.venues
  ADD CONSTRAINT chk_venue_contacts CHECK (
    jsonb_typeof(contacts) = 'array' AND jsonb_array_length(contacts) <= 30
  );

-- One person from the old columns, leaving out what is empty.
CREATE OR REPLACE FUNCTION public.venue_contact_from_columns(
  p_role TEXT, p_name TEXT, p_phone TEXT, p_email TEXT
) RETURNS JSONB AS $fn$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'role', nullif(trim(p_role), ''),
    'name', nullif(trim(p_name), ''),
    'phone', nullif(trim(p_phone), ''),
    'email', nullif(trim(p_email), '')
  ));
$fn$ LANGUAGE sql IMMUTABLE;

-- Existing venues: their one person becomes the first entry.
UPDATE public.venues
SET contacts = jsonb_build_array(
  public.venue_contact_from_columns(contact_role, contact_name, contact_phone, contact_email)
)
WHERE jsonb_array_length(contacts) = 0
  AND coalesce(contact_role, contact_name, contact_phone, contact_email) IS NOT NULL;

CREATE OR REPLACE FUNCTION public.venues_sync_contacts()
RETURNS TRIGGER AS $fn$
DECLARE
  old_cols_changed BOOLEAN;
  person JSONB;
BEGIN
  person := public.venue_contact_from_columns(
    NEW.contact_role, NEW.contact_name, NEW.contact_phone, NEW.contact_email
  );

  IF TG_OP = 'INSERT' THEN
    -- An older app sent only the old columns.
    IF jsonb_array_length(NEW.contacts) = 0 AND person <> '{}'::jsonb THEN
      NEW.contacts := jsonb_build_array(person);
    END IF;
  ELSE
    old_cols_changed :=
      NEW.contact_role IS DISTINCT FROM OLD.contact_role
      OR NEW.contact_name IS DISTINCT FROM OLD.contact_name
      OR NEW.contact_phone IS DISTINCT FROM OLD.contact_phone
      OR NEW.contact_email IS DISTINCT FROM OLD.contact_email;
    -- An older app edited the old columns and left the list alone.
    IF old_cols_changed AND NEW.contacts IS NOT DISTINCT FROM OLD.contacts THEN
      IF jsonb_array_length(NEW.contacts) = 0 THEN
        IF person <> '{}'::jsonb THEN
          NEW.contacts := jsonb_build_array(person);
        END IF;
      ELSE
        NEW.contacts := jsonb_set(NEW.contacts, '{0}', person);
      END IF;
    END IF;
  END IF;

  -- The old columns always mirror the first person.
  NEW.contact_role := left(nullif(trim(NEW.contacts -> 0 ->> 'role'), ''), 120);
  NEW.contact_name := left(nullif(trim(NEW.contacts -> 0 ->> 'name'), ''), 120);
  NEW.contact_phone := left(nullif(trim(NEW.contacts -> 0 ->> 'phone'), ''), 30);
  NEW.contact_email := nullif(trim(NEW.contacts -> 0 ->> 'email'), '');

  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_venues_sync_contacts ON public.venues;
CREATE TRIGGER trg_venues_sync_contacts
  BEFORE INSERT OR UPDATE ON public.venues
  FOR EACH ROW EXECUTE FUNCTION public.venues_sync_contacts();
