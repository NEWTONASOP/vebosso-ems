-- ============================================================================
-- VEBOSSO EMS — Documents, Salary, Messages (020)
-- ============================================================================
-- 1. employee_documents + private `documents` bucket
--      Owner: everything, on anyone's documents.
--      Member / manager: add and view their OWN documents only. They can never
--      rename, replace or delete one once it is uploaded.
-- 2. salary_requests — one row per person per month, Requested → Paid → Received.
--      Salary is paid outside the app; this only tracks the conversation.
--      Owner: everything. Member / manager: their own rows only; they may
--      request a month and mark a paid month as received, nothing else.
-- 3. boss_messages — a member / manager writes to the owner; the owner ticks
--      them done. Senders cannot edit or delete what they sent.
-- 4. announcements — any active employee may post to the whole company
--      (target_role = 'all'). Only the owner can delete.
--
-- Safe to run repeatedly (IF NOT EXISTS / OR REPLACE / DROP ... IF EXISTS).
-- ============================================================================


-- ============================================================================
-- 1. Documents
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.employee_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  -- Path inside the `documents` bucket, always "<user_id>/<file>".
  file_path TEXT NOT NULL,
  mime_type TEXT,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_document_name_length CHECK (length(name) BETWEEN 1 AND 120)
);

CREATE INDEX IF NOT EXISTS idx_employee_documents_user
  ON public.employee_documents(user_id, created_at DESC);

ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_all_documents" ON public.employee_documents;
CREATE POLICY "owner_all_documents" ON public.employee_documents
  FOR ALL TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "read_own_documents" ON public.employee_documents;
CREATE POLICY "read_own_documents" ON public.employee_documents
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "insert_own_documents" ON public.employee_documents;
CREATE POLICY "insert_own_documents" ON public.employee_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND uploaded_by = auth.uid()
    AND file_path LIKE auth.uid()::text || '/%'
  );
-- No UPDATE / DELETE policy for non-owners: uploaded documents are final.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  15728640, -- 15MB
  '{"image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"}'
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "documents_owner_all" ON storage.objects;
CREATE POLICY "documents_owner_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'documents' AND public.is_owner())
  WITH CHECK (bucket_id = 'documents' AND public.is_owner());

DROP POLICY IF EXISTS "documents_insert_own" ON storage.objects;
CREATE POLICY "documents_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "documents_read_own" ON storage.objects;
CREATE POLICY "documents_read_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
-- No UPDATE / DELETE for non-owners, so a file cannot be overwritten either.

-- Removing a profile also removes their document files (rows cascade).
CREATE OR REPLACE FUNCTION public.cleanup_user_storage_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id IN ('checkouts', 'documents')
  AND (storage.foldername(name))[1] = OLD.id::text;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- 2. Salary
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.salary_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- First day of the month the salary is for, e.g. 2026-08-01 for August.
  month DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'paid', 'received')),
  requested_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  paid_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_salary_month_first_day CHECK (EXTRACT(DAY FROM month) = 1),
  CONSTRAINT uniq_salary_user_month UNIQUE (user_id, month)
);

CREATE INDEX IF NOT EXISTS idx_salary_requests_user
  ON public.salary_requests(user_id, month DESC);
CREATE INDEX IF NOT EXISTS idx_salary_requests_status
  ON public.salary_requests(status);

DROP TRIGGER IF EXISTS set_salary_requests_updated_at ON public.salary_requests;
CREATE TRIGGER set_salary_requests_updated_at
  BEFORE UPDATE ON public.salary_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Non-owners may only: insert a 'requested' row for themselves, bump
-- requested_at on a still-requested row (a reminder), or flip paid → received.
CREATE OR REPLACE FUNCTION public.guard_salary_requests()
RETURNS TRIGGER AS $fn$
BEGIN
  IF public.is_owner() THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You can only manage your own salary requests';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'requested' OR NEW.paid_at IS NOT NULL
       OR NEW.paid_by IS NOT NULL OR NEW.received_at IS NOT NULL THEN
      RAISE EXCEPTION 'A new salary request must start as requested';
    END IF;
    NEW.requested_at := now();
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.month IS DISTINCT FROM OLD.month
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
     OR NEW.paid_by IS DISTINCT FROM OLD.paid_by THEN
    RAISE EXCEPTION 'Not allowed to change this salary record';
  END IF;

  IF OLD.status = 'requested' AND NEW.status = 'requested' THEN
    NEW.requested_at := now();
    NEW.received_at := OLD.received_at;
    RETURN NEW;
  END IF;

  IF OLD.status = 'paid' AND NEW.status = 'received' THEN
    NEW.received_at := now();
    NEW.requested_at := OLD.requested_at;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Not allowed to change this salary record';
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_guard_salary_requests ON public.salary_requests;
CREATE TRIGGER trg_guard_salary_requests
  BEFORE INSERT OR UPDATE ON public.salary_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_salary_requests();

ALTER TABLE public.salary_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_all_salary" ON public.salary_requests;
CREATE POLICY "owner_all_salary" ON public.salary_requests
  FOR ALL TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "read_own_salary" ON public.salary_requests;
CREATE POLICY "read_own_salary" ON public.salary_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "insert_own_salary" ON public.salary_requests;
CREATE POLICY "insert_own_salary" ON public.salary_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "update_own_salary" ON public.salary_requests;
CREATE POLICY "update_own_salary" ON public.salary_requests
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
-- No DELETE for non-owners.


-- ============================================================================
-- 3. Messages to the boss
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.boss_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  done_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_boss_message_length CHECK (length(body) BETWEEN 1 AND 2000)
);

CREATE INDEX IF NOT EXISTS idx_boss_messages_status
  ON public.boss_messages(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_boss_messages_sender
  ON public.boss_messages(sender_id, created_at DESC);

ALTER TABLE public.boss_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_all_boss_messages" ON public.boss_messages;
CREATE POLICY "owner_all_boss_messages" ON public.boss_messages
  FOR ALL TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "read_own_boss_messages" ON public.boss_messages;
CREATE POLICY "read_own_boss_messages" ON public.boss_messages
  FOR SELECT TO authenticated
  USING (sender_id = auth.uid());

DROP POLICY IF EXISTS "insert_own_boss_messages" ON public.boss_messages;
CREATE POLICY "insert_own_boss_messages" ON public.boss_messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND status = 'open' AND done_at IS NULL);


-- ============================================================================
-- 4. Team posts — anyone may post to everyone
-- ============================================================================

DROP POLICY IF EXISTS "employee_insert_team_post" ON public.announcements;
CREATE POLICY "employee_insert_team_post" ON public.announcements
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND target_role = 'all'
    AND target_user_id IS NULL
    AND public.get_user_role() IN ('manager', 'member')
  );

-- Set by the send-push-notification function the first time a post is
-- broadcast, so one post can never be pushed to everyone twice.
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS pushed_at TIMESTAMPTZ;

-- Members cannot read each other's profiles, so a post carries its author's
-- name and role. Filled in by the database, never taken from the client.
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS author_name TEXT;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS author_role TEXT;

CREATE OR REPLACE FUNCTION public.set_announcement_author()
RETURNS TRIGGER AS $fn$
BEGIN
  SELECT full_name, role INTO NEW.author_name, NEW.author_role
  FROM public.profiles
  WHERE id = NEW.created_by;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_set_announcement_author ON public.announcements;
CREATE TRIGGER trg_set_announcement_author
  BEFORE INSERT ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.set_announcement_author();

-- Existing posts
UPDATE public.announcements a
SET author_name = p.full_name, author_role = p.role
FROM public.profiles p
WHERE p.id = a.created_by AND a.author_name IS NULL;


-- ============================================================================
-- 5. Realtime
-- ============================================================================

DO $do$
DECLARE
  t TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['boss_messages', 'salary_requests'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END;
$do$;
