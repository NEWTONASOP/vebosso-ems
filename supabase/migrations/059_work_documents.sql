-- ============================================================================
-- VEBOSSO EMS — Work documents (059)
-- ============================================================================
-- PDF / Word files attached when checking in or out. They are stored in the
-- `documents` bucket and listed in that person's Documents under "Work",
-- next to the existing "Personal" ones (every older document stays Personal).
--
--   category      'personal' (default) | 'work'
--   work_log_id   the check-in / check-out they were attached to
--   work_phase    'check_in' | 'check_out'
--
-- A work file needs no approval, whether it was attached at check-in /
-- check-out or added by hand in the Work tab. The database decides this, and
-- only for a person's OWN documents (or the owner's) — personal documents still
-- wait for the owner. Managers can read work files (like they already read
-- check-in / check-out photos). Safe to run repeatedly.
-- ============================================================================

ALTER TABLE public.employee_documents
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'personal',
  ADD COLUMN IF NOT EXISTS work_log_id UUID REFERENCES public.work_logs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS work_phase TEXT;

ALTER TABLE public.employee_documents DROP CONSTRAINT IF EXISTS chk_document_category;
ALTER TABLE public.employee_documents
  ADD CONSTRAINT chk_document_category CHECK (category IN ('personal', 'work'));

ALTER TABLE public.employee_documents DROP CONSTRAINT IF EXISTS chk_document_work_phase;
ALTER TABLE public.employee_documents
  ADD CONSTRAINT chk_document_work_phase CHECK (work_phase IS NULL OR work_phase IN ('check_in', 'check_out'));

CREATE INDEX IF NOT EXISTS idx_employee_documents_work_log
  ON public.employee_documents(work_log_id) WHERE work_log_id IS NOT NULL;

-- Starting status: owner's uploads, and work files of the person's own work log, are approved.
CREATE OR REPLACE FUNCTION public.set_document_initial_status()
RETURNS TRIGGER AS $fn$
BEGIN
  IF public.is_owner() THEN
    NEW.status := 'approved';
    NEW.reviewed_by := auth.uid();
    NEW.reviewed_at := now();
  ELSIF NEW.category = 'work' AND NEW.user_id = auth.uid() THEN
    -- Their own work file. A link to a work log only counts if it is theirs.
    IF NEW.work_log_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.work_logs w WHERE w.id = NEW.work_log_id AND w.user_id = NEW.user_id
    ) THEN
      NEW.work_log_id := NULL;
      NEW.work_phase := NULL;
    END IF;
    NEW.status := 'approved';
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := now();
  ELSE
    NEW.category := 'personal';
    NEW.work_log_id := NULL;
    NEW.work_phase := NULL;
    NEW.status := 'pending';
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Managers read work files (rows and the files themselves).
DROP POLICY IF EXISTS "managers_read_work_documents" ON public.employee_documents;
CREATE POLICY "managers_read_work_documents" ON public.employee_documents
  FOR SELECT TO authenticated
  USING (category = 'work' AND public.get_user_role() = 'manager');

DROP POLICY IF EXISTS "documents_managers_read_work" ON storage.objects;
CREATE POLICY "documents_managers_read_work" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.get_user_role() = 'manager'
    AND storage.filename(name) LIKE 'work\_%'
  );
