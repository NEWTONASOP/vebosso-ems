-- ============================================================================
-- VEBOSSO EMS — Verify migration 018 is live
-- ============================================================================
-- Run in the Supabase SQL editor AFTER applying 018_security_fixes.sql.
-- Every row should report PASS. Read-only — safe to run on production.
-- ============================================================================

-- 1. The work_logs guard must fire on INSERT as well as UPDATE.
SELECT
  CASE WHEN bool_or(tgtype & 4 = 4) AND bool_or(tgtype & 16 = 16)
       THEN 'PASS' ELSE 'FAIL' END AS result,
  'trg_prevent_self_approval covers INSERT and UPDATE' AS check_name
FROM pg_trigger
WHERE tgname = 'trg_prevent_self_approval'
  AND tgrelid = 'public.work_logs'::regclass;

-- 2. The restored approval-flag guards from 007 must be back in the function body.
SELECT
  CASE WHEN prosrc LIKE '%Members cannot approve their own check-in%'
        AND prosrc LIKE '%Members cannot approve their own check-out%'
       THEN 'PASS' ELSE 'FAIL' END AS result,
  'check_in_approved / check_out_approved guards restored' AS check_name
FROM pg_proc
WHERE proname = 'prevent_self_approval'
  AND pronamespace = 'public'::regnamespace;

-- 3. manager_id and must_change_password must be covered by the escalation guard.
SELECT
  CASE WHEN prosrc LIKE '%change who manages you%'
        AND prosrc LIKE '%must_change_password cannot be set directly%'
       THEN 'PASS' ELSE 'FAIL' END AS result,
  'manager_id + must_change_password guarded' AS check_name
FROM pg_proc
WHERE proname = 'prevent_privilege_escalation'
  AND pronamespace = 'public'::regnamespace;

-- 4. Both new RPCs must exist and be callable by authenticated users only.
SELECT
  CASE WHEN count(*) = 2 THEN 'PASS' ELSE 'FAIL' END AS result,
  'submit_backfill + complete_password_change exist' AS check_name
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('submit_backfill', 'complete_password_change');

SELECT
  CASE WHEN NOT has_function_privilege('anon', p.oid, 'EXECUTE')
        AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
       THEN 'PASS' ELSE 'FAIL' END AS result,
  'RPC grants correct: ' || p.proname AS check_name
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname IN ('submit_backfill', 'complete_password_change');

-- 5. Insert policies must carry a WITH CHECK clause (not just USING).
SELECT
  CASE WHEN with_check LIKE '%pending_approval%' THEN 'PASS' ELSE 'FAIL' END AS result,
  'WITH CHECK present on ' || policyname AS check_name
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'work_logs'
  AND policyname IN ('member_insert_own_work_logs', 'manager_insert_own_work_logs');

-- 6. Backfill grants that were never consumed by the old broken client write.
--    Any rows here are dates a member could still replay — review and close them out.
SELECT
  'REVIEW' AS result,
  format('%s unused backfill grant(s) predating this migration', count(*)) AS check_name
FROM public.backfill_permissions bp
WHERE bp.is_used = false
  AND EXISTS (
    SELECT 1 FROM public.work_logs wl
    WHERE wl.user_id = bp.user_id AND wl.date = bp.date
  );

-- 7. Work logs that could only exist if they were forged (pre-approved on
--    insert by a non-owner). Expect zero; investigate anything returned.
SELECT
  'REVIEW' AS result,
  format('%s suspicious work log(s): approved with no approver', count(*)) AS check_name
FROM public.work_logs
WHERE (check_in_approved AND check_in_approved_by IS NULL)
   OR (check_out_approved AND check_out_approved_by IS NULL);
