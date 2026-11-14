-- ============================================================================
-- VEBOSSO EMS — Packages, a third kind of bill (077)
-- ============================================================================
-- Fixed packages kept next to estimates and client bills: the same fields,
-- PDF and sharing as a client bill, numbered P-0001…, but never completed and
-- never moved — a package can't become an estimate / client bill, and neither
-- can become a package. Saved packages sit in status 'pending' like estimates
-- (the app shows no Pending / Completed for them).
-- Who can see / change them is unchanged (bills access rules, 062 / 064).
-- Safe to run repeatedly.
-- ============================================================================

-- 1. Allow the new kind ------------------------------------------------------
ALTER TABLE public.bills DROP CONSTRAINT IF EXISTS bills_kind_check;
ALTER TABLE public.bills
  ADD CONSTRAINT bills_kind_check CHECK (kind IN ('estimate', 'client', 'package'));

ALTER TABLE public.bill_counters DROP CONSTRAINT IF EXISTS bill_counters_kind_check;
ALTER TABLE public.bill_counters
  ADD CONSTRAINT bill_counters_kind_check CHECK (kind IN ('estimate', 'client', 'package'));
INSERT INTO public.bill_counters (kind) VALUES ('package') ON CONFLICT DO NOTHING;

-- 2. P- numbers --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.next_bill_number(p_kind TEXT)
RETURNS TEXT AS $fn$
DECLARE
  n INT;
BEGIN
  UPDATE public.bill_counters SET next_value = next_value + 1
  WHERE kind = p_kind
  RETURNING next_value - 1 INTO n;
  RETURN (CASE p_kind WHEN 'client' THEN 'B-' WHEN 'package' THEN 'P-' ELSE 'E-' END) || lpad(n::text, 4, '0');
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.next_bill_number(TEXT) FROM PUBLIC;

-- 3. Packages never move, and nothing becomes one; never completed ------------
CREATE OR REPLACE FUNCTION public.bills_before_write()
RETURNS TRIGGER AS $fn$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.kind IS DISTINCT FROM OLD.kind
     AND (OLD.kind = 'package' OR NEW.kind = 'package') THEN
    RAISE EXCEPTION 'A package can''t be changed into another kind of bill, or the other way round';
  END IF;
  IF NEW.kind = 'package' AND NEW.status IN ('done', 'completed') THEN
    RAISE EXCEPTION 'A package can''t be marked completed';
  END IF;

  -- Estimate → client bill: keep the estimate's number, get a client number.
  IF TG_OP = 'UPDATE' AND OLD.kind = 'estimate' AND NEW.kind = 'client' THEN
    NEW.estimate_number := coalesce(OLD.number, NEW.estimate_number);
    NEW.number := NULL;
  END IF;

  -- First time out of draft (or just converted): hand out a number.
  IF NEW.status <> 'draft' AND NEW.number IS NULL THEN
    NEW.number := public.next_bill_number(NEW.kind);
  END IF;

  -- Remember where a trashed bill came from, so restore puts it back.
  IF TG_OP = 'UPDATE' AND NEW.status = 'trash' AND OLD.status <> 'trash' THEN
    NEW.prev_status := OLD.status;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
