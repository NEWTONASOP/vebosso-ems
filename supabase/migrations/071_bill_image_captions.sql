-- ============================================================================
-- VEBOSSO EMS — Bill image captions (071)
-- ============================================================================
-- Each photo on a bill can say what it shows. The bill keeps one caption per
-- photo, keyed by the photo's storage path:
--   { "img/<bill>/1730000000000_ab12.jpg": "Mandap with floral arch", … }
-- The captions print under their photos on the bill PDF.
-- Safe to run repeatedly.
-- ============================================================================

ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS image_captions JSONB NOT NULL DEFAULT '{}'::jsonb;
