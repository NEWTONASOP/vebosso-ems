-- ============================================================================
-- VEBOSSO EMS — Navgrah Leads: a voice note in the remarks (054)
-- ============================================================================
-- Next to the written remarks, a lead can carry one voice note, stored in the
-- private voice-notes bucket (033) under lead/<who recorded it>/…  Anyone
-- with Navgrah Leads (the same people who see the leads) can play them; the
-- person who recorded one, or the owner, can delete the file. Changing the
-- voice note counts as working on the lead (050). Safe to run repeatedly.
-- ============================================================================

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS remarks_voice_path TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS remarks_voice_ms INT;

-- Storage: lead/<uploader id>/<file>
DROP POLICY IF EXISTS "voice_lead_read" ON storage.objects;
CREATE POLICY "voice_lead_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'voice-notes'
    AND (storage.foldername(name))[1] = 'lead'
    AND public.has_feature('leads')
  );

DROP POLICY IF EXISTS "voice_lead_add" ON storage.objects;
CREATE POLICY "voice_lead_add" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'voice-notes'
    AND (storage.foldername(name))[1] = 'lead'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND public.has_feature('leads')
  );

DROP POLICY IF EXISTS "voice_lead_remove" ON storage.objects;
CREATE POLICY "voice_lead_remove" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'voice-notes'
    AND (storage.foldername(name))[1] = 'lead'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- 050, plus the voice note.
CREATE OR REPLACE FUNCTION public.set_lead_touched()
RETURNS TRIGGER AS $fn$
BEGIN
  IF NEW.touched_at IS NULL AND (
       NEW.name IS DISTINCT FROM OLD.name
    OR NEW.dof IS DISTINCT FROM OLD.dof
    OR NEW.function IS DISTINCT FROM OLD.function
    OR NEW.contact IS DISTINCT FROM OLD.contact
    OR NEW.remarks IS DISTINCT FROM OLD.remarks
    OR NEW.remarks_voice_path IS DISTINCT FROM OLD.remarks_voice_path
  ) THEN
    NEW.touched_at := now();
  END IF;
  IF OLD.touched_at IS NOT NULL AND NEW.touched_at IS NULL THEN
    NEW.touched_at := OLD.touched_at;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SET search_path = public;
