-- ============================================================================
-- VEBOSSO EMS — Account receipt photos wouldn't load (039)
-- ============================================================================
-- 036 limited receipt photos to people who can see the account, with
--   WHERE a.id::text = (storage.foldername(name))[1]
-- but inside that sub-select `name` meant accounts.name, not the file's path,
-- so the rule matched nothing: nobody could view or add a receipt photo
-- ("Either the object does not exist or you do not have access to it").
-- The file's path is now spelled out as objects.name.
-- Safe to run repeatedly.
-- ============================================================================

DROP POLICY IF EXISTS "account_receipts_own_all" ON storage.objects;
CREATE POLICY "account_receipts_own_all" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'account-receipts'
    AND EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id::text = (storage.foldername(objects.name))[1]
    )
  )
  WITH CHECK (
    bucket_id = 'account-receipts'
    AND EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id::text = (storage.foldername(objects.name))[1]
    )
  );
