-- ============================================================================
-- VEBOSSO EMS — Owners can see everyone's books, view only (044)
-- ============================================================================
-- Since 036 each person given Accounts keeps private books. Owners can now
-- read them too — accounts, entries, receipt photos and totals — but only the
-- person whose books they are can add, change or delete anything in them.
-- Members and managers still see only their own. Safe to run repeatedly.
-- ============================================================================

-- Accounts: one more way to read. Writes still go through accounts_own_all
-- (036), which only lets an owner change the owners' books.
DROP POLICY IF EXISTS "accounts_owner_read_all" ON public.accounts;
CREATE POLICY "accounts_owner_read_all" ON public.accounts
  FOR SELECT TO authenticated
  USING (public.is_owner());

-- Entries: read whenever the account is readable; change only when the
-- signed-in person may change the account itself.
DROP POLICY IF EXISTS "account_txns_own_all" ON public.account_transactions;
DROP POLICY IF EXISTS "account_txns_read" ON public.account_transactions;
DROP POLICY IF EXISTS "account_txns_add" ON public.account_transactions;
DROP POLICY IF EXISTS "account_txns_edit" ON public.account_transactions;
DROP POLICY IF EXISTS "account_txns_delete" ON public.account_transactions;

CREATE POLICY "account_txns_read" ON public.account_transactions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = account_id));

CREATE POLICY "account_txns_add" ON public.account_transactions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.accounts a WHERE a.id = account_id AND public.can_use_account(a.created_by)
  ));

CREATE POLICY "account_txns_edit" ON public.account_transactions
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.accounts a WHERE a.id = account_id AND public.can_use_account(a.created_by)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.accounts a WHERE a.id = account_id AND public.can_use_account(a.created_by)
  ));

CREATE POLICY "account_txns_delete" ON public.account_transactions
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.accounts a WHERE a.id = account_id AND public.can_use_account(a.created_by)
  ));

-- Receipt photos (<account id>/<file>): same split. objects.name, not name —
-- inside the sub-select a bare `name` is the account's name (039).
DROP POLICY IF EXISTS "account_receipts_own_all" ON storage.objects;
DROP POLICY IF EXISTS "account_receipts_read" ON storage.objects;
DROP POLICY IF EXISTS "account_receipts_add" ON storage.objects;
DROP POLICY IF EXISTS "account_receipts_edit" ON storage.objects;
DROP POLICY IF EXISTS "account_receipts_delete" ON storage.objects;

CREATE POLICY "account_receipts_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'account-receipts'
    AND EXISTS (SELECT 1 FROM public.accounts a WHERE a.id::text = (storage.foldername(objects.name))[1])
  );

CREATE POLICY "account_receipts_add" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'account-receipts'
    AND EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id::text = (storage.foldername(objects.name))[1] AND public.can_use_account(a.created_by)
    )
  );

CREATE POLICY "account_receipts_edit" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'account-receipts'
    AND EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id::text = (storage.foldername(objects.name))[1] AND public.can_use_account(a.created_by)
    )
  )
  WITH CHECK (
    bucket_id = 'account-receipts'
    AND EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id::text = (storage.foldername(objects.name))[1] AND public.can_use_account(a.created_by)
    )
  );

CREATE POLICY "account_receipts_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'account-receipts'
    AND EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id::text = (storage.foldername(objects.name))[1] AND public.can_use_account(a.created_by)
    )
  );

-- account_summaries (026) is SECURITY INVOKER, so an owner now gets totals for
-- every account; the app picks out the book being looked at.
