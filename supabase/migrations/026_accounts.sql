-- ============================================================================
-- VEBOSSO EMS — Accounts ledger (026)
-- ============================================================================
-- The owner's books: any number of accounts (a person, a party, a bank…),
-- each a list of dated credit / debit entries. Owner only — nobody else can
-- read or write any of it.
--
-- Balance convention: balance = credit − debit.
-- Safe to run repeatedly.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  note TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_account_name CHECK (length(trim(name)) BETWEEN 1 AND 120),
  CONSTRAINT chk_account_note CHECK (note IS NULL OR length(note) <= 500)
);

CREATE TABLE IF NOT EXISTS public.account_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  txn_date DATE NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('credit', 'debit')),
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  particular TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_txn_particular CHECK (particular IS NULL OR length(particular) <= 500)
);

CREATE INDEX IF NOT EXISTS idx_account_txn_account_date
  ON public.account_transactions(account_id, txn_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_txn_date
  ON public.account_transactions(txn_date);

DROP TRIGGER IF EXISTS set_accounts_updated_at ON public.accounts;
CREATE TRIGGER set_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_account_txn_updated_at ON public.account_transactions;
CREATE TRIGGER set_account_txn_updated_at
  BEFORE UPDATE ON public.account_transactions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_all_accounts" ON public.accounts;
CREATE POLICY "owner_all_accounts" ON public.accounts
  FOR ALL TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "owner_all_account_txns" ON public.account_transactions;
CREATE POLICY "owner_all_account_txns" ON public.account_transactions
  FOR ALL TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

-- ----------------------------------------------------------------------------
-- Totals per account, for a date range (period) and for all time, computed in
-- the database so the list never has to download every entry.
-- SECURITY INVOKER: RLS above still applies, so only the owner gets rows.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.account_summaries(p_from DATE DEFAULT NULL, p_to DATE DEFAULT NULL)
RETURNS TABLE (
  account_id UUID,
  period_credit NUMERIC,
  period_debit NUMERIC,
  total_credit NUMERIC,
  total_debit NUMERIC,
  entry_count BIGINT,
  last_txn_date DATE
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $fn$
  SELECT
    a.id,
    coalesce(sum(t.amount) FILTER (
      WHERE t.kind = 'credit'
        AND (p_from IS NULL OR t.txn_date >= p_from)
        AND (p_to IS NULL OR t.txn_date <= p_to)), 0),
    coalesce(sum(t.amount) FILTER (
      WHERE t.kind = 'debit'
        AND (p_from IS NULL OR t.txn_date >= p_from)
        AND (p_to IS NULL OR t.txn_date <= p_to)), 0),
    coalesce(sum(t.amount) FILTER (WHERE t.kind = 'credit'), 0),
    coalesce(sum(t.amount) FILTER (WHERE t.kind = 'debit'), 0),
    count(t.id),
    max(t.txn_date)
  FROM public.accounts a
  LEFT JOIN public.account_transactions t ON t.account_id = a.id
  GROUP BY a.id;
$fn$;

GRANT EXECUTE ON FUNCTION public.account_summaries(DATE, DATE) TO authenticated;
