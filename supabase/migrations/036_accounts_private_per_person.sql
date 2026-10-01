-- ============================================================================
-- VEBOSSO EMS — Accounts: each person keeps their own books (036)
-- ============================================================================
-- 033 let the owner and everyone given Accounts see and edit the same books.
-- Now an account belongs to whoever created it (accounts.created_by, filled in
-- automatically) and only that person can see it, with its entries and its
-- receipt photos. Giving someone Accounts gives them a blank set of books of
-- their own. Taking Accounts away hides their books until it is given again —
-- nothing is deleted.
--
-- Owners share: every owner sees every account an owner created, plus accounts
-- nobody is recorded as the creator of (created_by NULL, e.g. made in the SQL
-- editor). Members and managers never see the owners' books.
-- Safe to run repeatedly.
-- ============================================================================

-- Is this account's creator an owner (or unknown)? SECURITY DEFINER so the
-- check does not depend on who may read profiles.
CREATE OR REPLACE FUNCTION public.account_is_owners(p_created_by UUID)
RETURNS BOOLEAN AS $fn$
  SELECT p_created_by IS NULL
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_created_by AND p.role = 'owner');
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Can the signed-in person see / change an account made by p_created_by?
-- Their own, or — for an owner — any account an owner made.
CREATE OR REPLACE FUNCTION public.can_use_account(p_created_by UUID)
RETURNS BOOLEAN AS $fn$
  SELECT public.has_feature('accounts') AND (
    p_created_by = auth.uid()
    OR (public.is_owner() AND public.account_is_owners(p_created_by))
  );
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.account_is_owners(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_use_account(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.account_is_owners(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_use_account(UUID) TO authenticated;

-- Accounts
DROP POLICY IF EXISTS "accounts_team_all" ON public.accounts;
DROP POLICY IF EXISTS "accounts_own_all" ON public.accounts;
CREATE POLICY "accounts_own_all" ON public.accounts
  FOR ALL TO authenticated
  USING (public.can_use_account(created_by))
  WITH CHECK (public.can_use_account(created_by));

-- Entries follow their account: the sub-select goes through the accounts
-- policy above, so an entry is visible only when its account is.
DROP POLICY IF EXISTS "account_txns_team_all" ON public.account_transactions;
DROP POLICY IF EXISTS "account_txns_own_all" ON public.account_transactions;
CREATE POLICY "account_txns_own_all" ON public.account_transactions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = account_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = account_id));

-- Receipt photos are stored as <account id>/<file>; same rule.
DROP POLICY IF EXISTS "account_receipts_team_all" ON storage.objects;
DROP POLICY IF EXISTS "account_receipts_own_all" ON storage.objects;
CREATE POLICY "account_receipts_own_all" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'account-receipts'
    AND EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id::text = (storage.foldername(name))[1]
    )
  )
  WITH CHECK (
    bucket_id = 'account-receipts'
    AND EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id::text = (storage.foldername(name))[1]
    )
  );

-- account_summaries (026) is SECURITY INVOKER, so it now totals only the
-- accounts the caller can see, without any change.
