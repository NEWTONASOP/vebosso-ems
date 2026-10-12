-- ============================================================================
-- VEBOSSO EMS — Folders for work documents (060)
-- ============================================================================
-- A person's work documents (059) can be sorted into folders. Folders are one
-- level (no folders inside folders) and belong to one person:
--   * the owner can make, rename and delete anyone's folders and move anyone's
--     documents into them;
--   * a person can do the same with their OWN folders and their OWN work
--     documents — and nothing else about a document: the database refuses any
--     other change to a document from a non-owner (they stay final, 020).
-- Deleting a folder never deletes documents: they go back to "no folder".
-- Personal documents (IDs etc.) are not put in folders.
-- Safe to run repeatedly. Run after 059.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.document_folders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Whose documents this folder organises.
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_folder_name CHECK (length(trim(name)) BETWEEN 1 AND 60)
);

CREATE INDEX IF NOT EXISTS idx_document_folders_user ON public.document_folders(user_id, created_at);

ALTER TABLE public.document_folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_all_folders" ON public.document_folders;
CREATE POLICY "owner_all_folders" ON public.document_folders
  FOR ALL TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "own_folders_all" ON public.document_folders;
CREATE POLICY "own_folders_all" ON public.document_folders
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Which folder a document is in (none = the top level).
ALTER TABLE public.employee_documents
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.document_folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_employee_documents_folder
  ON public.employee_documents(folder_id) WHERE folder_id IS NOT NULL;

-- A document can only sit in a folder of the same person.
CREATE OR REPLACE FUNCTION public.check_document_folder()
RETURNS TRIGGER AS $fn$
BEGIN
  IF NEW.folder_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.document_folders f WHERE f.id = NEW.folder_id AND f.user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'That folder belongs to someone else';
    END IF;
    IF NEW.category <> 'work' THEN
      RAISE EXCEPTION 'Only work documents go in folders';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_check_document_folder ON public.employee_documents;
CREATE TRIGGER trg_check_document_folder
  BEFORE INSERT OR UPDATE OF folder_id ON public.employee_documents
  FOR EACH ROW EXECUTE FUNCTION public.check_document_folder();

-- A person may change ONLY the folder of their own work documents.
DROP POLICY IF EXISTS "update_own_work_documents" ON public.employee_documents;
CREATE POLICY "update_own_work_documents" ON public.employee_documents
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND category = 'work')
  WITH CHECK (user_id = auth.uid() AND category = 'work');

CREATE OR REPLACE FUNCTION public.guard_document_update()
RETURNS TRIGGER AS $fn$
BEGIN
  IF NOT public.is_owner() THEN
    IF (to_jsonb(NEW) - 'folder_id') IS DISTINCT FROM (to_jsonb(OLD) - 'folder_id') THEN
      RAISE EXCEPTION 'Only the boss can change a document';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_guard_document_update ON public.employee_documents;
CREATE TRIGGER trg_guard_document_update
  BEFORE UPDATE ON public.employee_documents
  FOR EACH ROW EXECUTE FUNCTION public.guard_document_update();
