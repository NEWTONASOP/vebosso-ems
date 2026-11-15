-- ============================================================================
-- VEBOSSO EMS — "Not printed" mark on estimates and client bills (079)
-- ============================================================================
-- Holds the bill trigger for 077 too (package rules); 077 and 079 can run in
-- either order.
--
--   printed_at        set when someone marks the bill printed; NULL = not
--                     printed (every bill starts like that, old ones too)
--   printed_by_name   who marked it, filled in here
--   last_printed_at   the last time it was printed; kept when the mark is
--                     taken off by a change, so the app can say
--                     "changed after printing on …"
--
-- Saving changes to a printed bill (edited_at moves) or moving a printed
-- estimate to client bills (its number changes) takes the mark off again.
-- Taking the mark off by hand clears last_printed_at too.
-- Packages and drafts carry no mark in the app.
-- Safe to run repeatedly.
-- ============================================================================

ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS printed_at TIMESTAMPTZ;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS printed_by_name TEXT;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS last_printed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.bills_before_write()
RETURNS TRIGGER AS $fn$
BEGIN
  -- Packages (077): never moved, never completed.
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

  -- Printed mark.
  IF TG_OP = 'UPDATE' THEN
    IF OLD.printed_at IS NOT NULL
       AND (NEW.edited_at IS DISTINCT FROM OLD.edited_at OR NEW.kind IS DISTINCT FROM OLD.kind) THEN
      -- Changed after printing: print again. last_printed_at stays.
      NEW.printed_at := NULL;
      NEW.printed_by_name := NULL;
    ELSIF NEW.printed_at IS NOT NULL AND OLD.printed_at IS NULL THEN
      -- Marked printed now.
      NEW.printed_at := now();
      NEW.last_printed_at := NEW.printed_at;
      SELECT full_name INTO NEW.printed_by_name FROM public.profiles WHERE id = auth.uid();
    ELSIF NEW.printed_at IS NULL THEN
      NEW.printed_by_name := NULL;
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
