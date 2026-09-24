-- ============================================================================
-- VEBOSSO EMS — Bills (027)
-- ============================================================================
-- Estimates and client bills. Owner only — nobody else can read or write any
-- of it (tables, images, generated PDFs).
--
--   kind    estimate | client
--   status  draft (auto-saved, not yet saved by the owner)
--           pending | done | completed   (client bills; estimates use pending)
--           trash   (prev_status remembers where to restore to)
--
-- Numbers are handed out by the database the first time a bill leaves draft:
-- estimates E-0001…, client bills B-0001…. Turning an estimate into a client
-- bill gives it a B- number and keeps the E- number in estimate_number.
-- Safe to run repeatedly.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kind TEXT NOT NULL DEFAULT 'estimate' CHECK (kind IN ('estimate', 'client')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending', 'done', 'completed', 'trash')),
  prev_status TEXT,
  number TEXT,
  estimate_number TEXT,

  prepared_by TEXT,
  client_name TEXT,
  venue TEXT,
  function_date DATE,
  guests TEXT,
  hall_floor TEXT,
  event_type TEXT,
  timing TEXT,
  phone TEXT,
  alt_phone TEXT,
  address TEXT,

  -- Services provided: [{ "description": "Decoration" }, …] — no prices.
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Typed by the owner, all three.
  total NUMERIC(14, 2),
  advance NUMERIC(14, 2),
  balance NUMERIC(14, 2),
  terms TEXT,
  -- Paths in the private `bills` bucket.
  images TEXT[] NOT NULL DEFAULT '{}',

  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_bill_items_array CHECK (jsonb_typeof(items) = 'array'),
  CONSTRAINT chk_bill_total CHECK (total IS NULL OR total >= 0),
  CONSTRAINT chk_bill_advance CHECK (advance IS NULL OR advance >= 0)
);

-- For a table created by an earlier run of this file (before balance).
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS balance NUMERIC(14, 2);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_bills_number ON public.bills(number) WHERE number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bills_kind_status ON public.bills(kind, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.bill_counters (
  kind TEXT PRIMARY KEY CHECK (kind IN ('estimate', 'client')),
  next_value INT NOT NULL DEFAULT 1
);
INSERT INTO public.bill_counters (kind) VALUES ('estimate'), ('client') ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.next_bill_number(p_kind TEXT)
RETURNS TEXT AS $fn$
DECLARE
  n INT;
BEGIN
  UPDATE public.bill_counters SET next_value = next_value + 1
  WHERE kind = p_kind
  RETURNING next_value - 1 INTO n;
  RETURN (CASE WHEN p_kind = 'client' THEN 'B-' ELSE 'E-' END) || lpad(n::text, 4, '0');
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.next_bill_number(TEXT) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.bills_before_write()
RETURNS TRIGGER AS $fn$
BEGIN
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

DROP TRIGGER IF EXISTS trg_bills_before_write ON public.bills;
CREATE TRIGGER trg_bills_before_write
  BEFORE INSERT OR UPDATE ON public.bills
  FOR EACH ROW EXECUTE FUNCTION public.bills_before_write();

-- Business details printed on every bill; one row.
CREATE TABLE IF NOT EXISTS public.bill_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  business_name TEXT NOT NULL DEFAULT 'VEBOSSO',
  tagline TEXT DEFAULT 'Venue Booking Service Solutions',
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  default_terms TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.bill_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_all_bills" ON public.bills;
CREATE POLICY "owner_all_bills" ON public.bills
  FOR ALL TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "owner_all_bill_settings" ON public.bill_settings;
CREATE POLICY "owner_all_bill_settings" ON public.bill_settings
  FOR ALL TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());
-- bill_counters: no policies — only next_bill_number() (definer) touches it.

-- Images and generated PDFs --------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bills',
  'bills',
  false,
  15728640, -- 15MB
  '{"image/jpeg", "image/png", "image/webp", "application/pdf"}'
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "bills_owner_all" ON storage.objects;
CREATE POLICY "bills_owner_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'bills' AND public.is_owner())
  WITH CHECK (bucket_id = 'bills' AND public.is_owner());
