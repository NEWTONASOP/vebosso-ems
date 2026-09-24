-- ============================================================================
-- VEBOSSO EMS — Document approval (023)
-- ============================================================================
-- Documents a member / manager uploads wait for the owner: pending → approved
-- or rejected. The database decides the starting status, so nobody can upload
-- a document as already approved; the owner's own uploads start approved.
-- Only the owner can change a status (non-owners have no UPDATE policy on
-- employee_documents — see 020). Run after 020. Safe to run repeatedly.
-- ============================================================================

ALTER TABLE public.employee_documents
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE public.employee_documents
  DROP CONSTRAINT IF EXISTS chk_document_status;
ALTER TABLE public.employee_documents
  ADD CONSTRAINT chk_document_status CHECK (status IN ('pending', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_employee_documents_status
  ON public.employee_documents(status);

CREATE OR REPLACE FUNCTION public.set_document_initial_status()
RETURNS TRIGGER AS $fn$
BEGIN
  IF public.is_owner() THEN
    NEW.status := 'approved';
    NEW.reviewed_by := auth.uid();
    NEW.reviewed_at := now();
  ELSE
    NEW.status := 'pending';
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_set_document_initial_status ON public.employee_documents;
CREATE TRIGGER trg_set_document_initial_status
  BEFORE INSERT ON public.employee_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_document_initial_status();

-- The owner's "Needs you now" inbox listens for new uploads.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'employee_documents'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_documents;
  END IF;
END;
$do$;
