-- ============================================================================
-- VEBOSSO EMS — Travel expenses (025)
-- ============================================================================
-- An employee submits what they spent — the amount, plus a note and/or
-- receipt photos (at least one of the two); the owner pays outside the
-- app and marks it paid; the employee confirms received. Same shape as salary_requests (020):
--   submitted → paid → received
-- Owner: everything. Member / manager: their own claims only — submit, and
-- flip paid → received. A submitted claim can't be edited or deleted by them.
-- Safe to run repeatedly.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.expense_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  spent_on DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Optional: a claim can be just receipt photos (see chk_expense_has_content).
  description TEXT,
  -- Rupees; required.
  amount NUMERIC(12, 2) NOT NULL,
  -- Paths in the private `expenses` bucket, "<user_id>/<file>".
  photos TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'paid', 'received')),
  paid_at TIMESTAMPTZ,
  paid_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_expense_description CHECK (description IS NULL OR length(description) <= 2000),
  CONSTRAINT chk_expense_amount CHECK (amount > 0),
  CONSTRAINT chk_expense_photos CHECK (coalesce(array_length(photos, 1), 0) <= 5),
  CONSTRAINT chk_expense_spent_on CHECK (spent_on <= CURRENT_DATE + 1)
);

-- Needs a note or at least one receipt. Also applied to a table created by an
-- earlier run of this file, when description was still required.
ALTER TABLE public.expense_claims ALTER COLUMN description DROP NOT NULL;
ALTER TABLE public.expense_claims DROP CONSTRAINT IF EXISTS chk_expense_description;
ALTER TABLE public.expense_claims
  ADD CONSTRAINT chk_expense_description CHECK (description IS NULL OR length(description) <= 2000);
ALTER TABLE public.expense_claims DROP CONSTRAINT IF EXISTS chk_expense_has_content;
ALTER TABLE public.expense_claims
  ADD CONSTRAINT chk_expense_has_content CHECK (
    length(trim(coalesce(description, ''))) > 0 OR coalesce(array_length(photos, 1), 0) > 0
  );

-- Amount is required. Also applied to a table from an earlier run of this
-- file, when it was optional.
ALTER TABLE public.expense_claims ALTER COLUMN amount SET NOT NULL;
ALTER TABLE public.expense_claims DROP CONSTRAINT IF EXISTS chk_expense_amount;
ALTER TABLE public.expense_claims ADD CONSTRAINT chk_expense_amount CHECK (amount > 0);

CREATE INDEX IF NOT EXISTS idx_expense_claims_user ON public.expense_claims(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expense_claims_status ON public.expense_claims(status);

DROP TRIGGER IF EXISTS set_expense_claims_updated_at ON public.expense_claims;
CREATE TRIGGER set_expense_claims_updated_at
  BEFORE UPDATE ON public.expense_claims
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.guard_expense_claims()
RETURNS TRIGGER AS $fn$
BEGIN
  IF public.is_owner() THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You can only manage your own expenses';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status := 'submitted';
    NEW.paid_at := NULL;
    NEW.paid_by := NULL;
    NEW.received_at := NULL;
    -- Receipts must live in the submitter's own folder.
    IF EXISTS (
      SELECT 1 FROM unnest(NEW.photos) p WHERE p NOT LIKE auth.uid()::text || '/%'
    ) THEN
      RAISE EXCEPTION 'Invalid receipt path';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: the only thing an employee may do is confirm a paid claim arrived.
  IF OLD.status = 'paid' AND NEW.status = 'received'
     AND NEW.description IS NOT DISTINCT FROM OLD.description
     AND NEW.amount IS NOT DISTINCT FROM OLD.amount
     AND NEW.photos IS NOT DISTINCT FROM OLD.photos
     AND NEW.spent_on IS NOT DISTINCT FROM OLD.spent_on
     AND NEW.paid_at IS NOT DISTINCT FROM OLD.paid_at
     AND NEW.paid_by IS NOT DISTINCT FROM OLD.paid_by THEN
    NEW.received_at := now();
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Not allowed to change this expense';
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_guard_expense_claims ON public.expense_claims;
CREATE TRIGGER trg_guard_expense_claims
  BEFORE INSERT OR UPDATE ON public.expense_claims
  FOR EACH ROW EXECUTE FUNCTION public.guard_expense_claims();

ALTER TABLE public.expense_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_all_expenses" ON public.expense_claims;
CREATE POLICY "owner_all_expenses" ON public.expense_claims
  FOR ALL TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "read_own_expenses" ON public.expense_claims;
CREATE POLICY "read_own_expenses" ON public.expense_claims
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "insert_own_expenses" ON public.expense_claims;
CREATE POLICY "insert_own_expenses" ON public.expense_claims
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "update_own_expenses" ON public.expense_claims;
CREATE POLICY "update_own_expenses" ON public.expense_claims
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
-- No DELETE for non-owners.

-- Receipts ------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'expenses',
  'expenses',
  false,
  10485760, -- 10MB
  '{"image/jpeg", "image/png", "image/webp", "image/heic"}'
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "expenses_owner_all" ON storage.objects;
CREATE POLICY "expenses_owner_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'expenses' AND public.is_owner())
  WITH CHECK (bucket_id = 'expenses' AND public.is_owner());

DROP POLICY IF EXISTS "expenses_insert_own" ON storage.objects;
CREATE POLICY "expenses_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'expenses' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "expenses_read_own" ON storage.objects;
CREATE POLICY "expenses_read_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'expenses' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Removing a profile also removes their receipts.
CREATE OR REPLACE FUNCTION public.cleanup_user_storage_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id IN ('checkouts', 'documents', 'avatars', 'expenses')
  AND (storage.foldername(name))[1] = OLD.id::text;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Realtime for the owner's inbox.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'expense_claims'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.expense_claims;
  END IF;
END;
$do$;
