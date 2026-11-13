-- ============================================================================
-- VEBOSSO EMS — Categories on ledger entries (076)
-- ============================================================================
-- An entry can carry a category ("Salary", "Rent"…) so the books can be
-- filtered by it: inside one account, or across all of someone's accounts.
-- Categories are plain text; the app offers the ones already used, so the
-- same spelling is reused. Who can see / change an entry is unchanged (RLS on
-- account_transactions, 036 / 044).
-- Safe to run repeatedly.
-- ============================================================================

ALTER TABLE public.account_transactions
  ADD COLUMN IF NOT EXISTS category TEXT;

ALTER TABLE public.account_transactions DROP CONSTRAINT IF EXISTS chk_txn_category;
ALTER TABLE public.account_transactions
  ADD CONSTRAINT chk_txn_category CHECK (
    category IS NULL OR length(trim(category)) BETWEEN 1 AND 40
  );

CREATE INDEX IF NOT EXISTS idx_account_txn_category
  ON public.account_transactions(category, txn_date DESC)
  WHERE category IS NOT NULL;

-- The categories in use, in the given accounts (all visible ones when NULL).
-- SECURITY INVOKER: RLS decides which entries are counted.
CREATE OR REPLACE FUNCTION public.account_categories(p_account_ids UUID[] DEFAULT NULL)
RETURNS TABLE (category TEXT, entry_count BIGINT)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $fn$
  SELECT t.category, count(*)
  FROM public.account_transactions t
  WHERE t.category IS NOT NULL
    AND (p_account_ids IS NULL OR t.account_id = ANY (p_account_ids))
  GROUP BY t.category
  ORDER BY lower(t.category);
$fn$;

GRANT EXECUTE ON FUNCTION public.account_categories(UUID[]) TO authenticated;
