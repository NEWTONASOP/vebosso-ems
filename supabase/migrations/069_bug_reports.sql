-- ============================================================================
-- VEBOSSO EMS — Problem reports from inside the app (069)
--
-- Anyone signed in can report a problem: what happened, where (optional), up
-- to 3 screenshots (Cloudinary links), and the device / app version the app
-- fills in. Owners see every report and mark them fixed (or open again);
-- the person who sent one can see their own.
-- Safe to run repeatedly.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bug_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reported_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  -- Kept as written: the person may be removed later.
  reporter_name TEXT,
  description TEXT NOT NULL,
  -- Where in the app, in their words (optional).
  place TEXT,
  -- [{ url, public_id, width, height, bytes, added_at, added_by_name }]
  screenshots JSONB NOT NULL DEFAULT '[]'::jsonb,
  platform TEXT,
  os_version TEXT,
  device TEXT,
  app_version TEXT,
  update_id TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'fixed')),
  fixed_at TIMESTAMPTZ,
  fixed_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_bug_description CHECK (length(trim(description)) BETWEEN 1 AND 5000),
  CONSTRAINT chk_bug_place CHECK (place IS NULL OR length(place) <= 200),
  CONSTRAINT chk_bug_screenshots CHECK (jsonb_typeof(screenshots) = 'array' AND jsonb_array_length(screenshots) <= 3)
);

CREATE INDEX IF NOT EXISTS idx_bug_reports_open ON public.bug_reports(status, created_at DESC);

-- Who sent it is always the signed-in person, with their name as it is now;
-- a new report always starts open. Marking fixed stamps who and when.
CREATE OR REPLACE FUNCTION public.bug_reports_stamp()
RETURNS TRIGGER AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.reported_by := auth.uid();
    SELECT full_name INTO NEW.reporter_name FROM public.profiles WHERE id = auth.uid();
    NEW.status := 'open';
    NEW.fixed_at := NULL;
    NEW.fixed_by_name := NULL;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'fixed' THEN
      NEW.fixed_at := now();
      SELECT full_name INTO NEW.fixed_by_name FROM public.profiles WHERE id = auth.uid();
    ELSE
      NEW.fixed_at := NULL;
      NEW.fixed_by_name := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_bug_reports_stamp ON public.bug_reports;
CREATE TRIGGER trg_bug_reports_stamp
  BEFORE INSERT OR UPDATE ON public.bug_reports
  FOR EACH ROW EXECUTE FUNCTION public.bug_reports_stamp();

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bug_reports_add" ON public.bug_reports;
CREATE POLICY "bug_reports_add" ON public.bug_reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "bug_reports_read" ON public.bug_reports;
CREATE POLICY "bug_reports_read" ON public.bug_reports
  FOR SELECT TO authenticated
  USING (public.is_owner() OR reported_by = auth.uid());

DROP POLICY IF EXISTS "bug_reports_owner_edit" ON public.bug_reports;
CREATE POLICY "bug_reports_owner_edit" ON public.bug_reports
  FOR UPDATE TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "bug_reports_owner_delete" ON public.bug_reports;
CREATE POLICY "bug_reports_owner_delete" ON public.bug_reports
  FOR DELETE TO authenticated
  USING (public.is_owner());
