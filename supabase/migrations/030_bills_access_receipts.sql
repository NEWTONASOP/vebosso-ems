-- ============================================================================
-- VEBOSSO EMS — Bills access, bill statuses, receipts on entries (030)
-- ============================================================================
-- 1. bill_access — the owner can give the Bills feature to chosen people.
--      They can do everything in Bills (create, edit, share, settings…).
--      Kept in its own owner-managed table so profile guards stay untouched.
-- 2. Bill statuses — "done" is gone: pending → completed. Existing "done"
--      bills become completed.
-- 3. bills.edited_at — set when a saved bill is changed again; the PDF shows
--      it as revised.
-- 4. Receipts on account entries — optional photos per ledger entry, in a
--      private owner-only `account-receipts` bucket.
--
-- Run after 029. Safe to run repeatedly.
-- ============================================================================


-- ============================================================================
-- 1. Bills access
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bill_access (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bill_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_all_bill_access" ON public.bill_access;
CREATE POLICY "owner_all_bill_access" ON public.bill_access
  FOR ALL TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "read_own_bill_access" ON public.bill_access;
CREATE POLICY "read_own_bill_access" ON public.bill_access
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- The owner, or an active person the owner gave Bills to.
CREATE OR REPLACE FUNCTION public.can_manage_bills()
RETURNS BOOLEAN AS $fn$
  SELECT public.is_owner() OR EXISTS (
    SELECT 1
    FROM public.bill_access a
    JOIN public.profiles p ON p.id = a.user_id
    WHERE a.user_id = auth.uid() AND p.is_active
  );
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.can_manage_bills() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_bills() TO authenticated;

DROP POLICY IF EXISTS "owner_all_bills" ON public.bills;
DROP POLICY IF EXISTS "bills_team_all" ON public.bills;
CREATE POLICY "bills_team_all" ON public.bills
  FOR ALL TO authenticated
  USING (public.can_manage_bills())
  WITH CHECK (public.can_manage_bills());

DROP POLICY IF EXISTS "owner_all_bill_settings" ON public.bill_settings;
DROP POLICY IF EXISTS "bill_settings_team_all" ON public.bill_settings;
CREATE POLICY "bill_settings_team_all" ON public.bill_settings
  FOR ALL TO authenticated
  USING (public.can_manage_bills())
  WITH CHECK (public.can_manage_bills());

DROP POLICY IF EXISTS "bills_owner_all" ON storage.objects;
DROP POLICY IF EXISTS "bills_team_all" ON storage.objects;
CREATE POLICY "bills_team_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'bills' AND public.can_manage_bills())
  WITH CHECK (bucket_id = 'bills' AND public.can_manage_bills());


-- ============================================================================
-- 2. Statuses: draft | pending | completed | trash
-- ============================================================================

UPDATE public.bills SET status = 'completed' WHERE status = 'done';
UPDATE public.bills SET prev_status = 'completed' WHERE prev_status = 'done';

ALTER TABLE public.bills DROP CONSTRAINT IF EXISTS bills_status_check;
ALTER TABLE public.bills DROP CONSTRAINT IF EXISTS chk_bill_status;
ALTER TABLE public.bills
  ADD CONSTRAINT chk_bill_status CHECK (status IN ('draft', 'pending', 'completed', 'trash'));


-- ============================================================================
-- 3. Revised bills
-- ============================================================================

ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;


-- ============================================================================
-- 4. Receipts on account entries (owner only, like the rest of Accounts)
-- ============================================================================

ALTER TABLE public.account_transactions
  ADD COLUMN IF NOT EXISTS receipts TEXT[] NOT NULL DEFAULT '{}';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'account-receipts',
  'account-receipts',
  false,
  10485760, -- 10MB
  '{"image/jpeg", "image/png", "image/webp"}'
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "account_receipts_owner_all" ON storage.objects;
CREATE POLICY "account_receipts_owner_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'account-receipts' AND public.is_owner())
  WITH CHECK (bucket_id = 'account-receipts' AND public.is_owner());
