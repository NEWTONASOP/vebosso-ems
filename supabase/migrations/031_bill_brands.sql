-- ============================================================================
-- VEBOSSO EMS — Bill brands (031)
-- ============================================================================
-- Bills can be made for two brands, VEBOSSO and Navgrah. Each bill carries its
-- brand; each brand has its own business details and default terms in
-- bill_settings (id 1 = VEBOSSO, id 2 = Navgrah). Numbering stays shared.
-- Run after 030. Safe to run repeatedly.
-- ============================================================================

ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS brand TEXT NOT NULL DEFAULT 'vebosso';

ALTER TABLE public.bills DROP CONSTRAINT IF EXISTS chk_bill_brand;
ALTER TABLE public.bills
  ADD CONSTRAINT chk_bill_brand CHECK (brand IN ('vebosso', 'navgrah'));

CREATE INDEX IF NOT EXISTS idx_bills_brand ON public.bills(brand, kind, status, updated_at DESC);

-- bill_settings was a single row (id = 1); allow a second one for Navgrah.
ALTER TABLE public.bill_settings DROP CONSTRAINT IF EXISTS bill_settings_id_check;
ALTER TABLE public.bill_settings DROP CONSTRAINT IF EXISTS chk_bill_settings_id;
ALTER TABLE public.bill_settings
  ADD CONSTRAINT chk_bill_settings_id CHECK (id IN (1, 2));

INSERT INTO public.bill_settings (id, business_name, tagline, address, phone, email, website, default_terms)
VALUES (
  2,
  'Navgrah',
  'imagination to reality',
  E'The Ornate, Sector-4,\nVaishali, Ghaziabad - 201010',
  '+91 98112 71910, +91 98738 80909',
  'navgrahdecor@gmail.com',
  NULL,
  E'1. 50% Advance (at the time of confirmation) and the rest 50% payment should be cleared before the function starts.\n2. Extra add-on services will be chargeable as per demand.\n3. If any payment is transferred to the account, an extra 18% GST will be charged on the amount.'
)
ON CONFLICT (id) DO NOTHING;
