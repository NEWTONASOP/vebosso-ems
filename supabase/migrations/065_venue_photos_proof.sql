-- ============================================================================
-- VEBOSSO EMS — Venue photos, and proof of the "in business" permission (065)
--
-- Two things kept on a venue:
--   photos                  pictures taken at / received from the venue
--   business_proof          the permission message or email the venue sent,
--                           pasted in as text
--   business_proof_images   screenshots of that permission
-- The pictures themselves are in Cloudinary (uploaded from the app with an
-- unsigned preset); these columns hold their links: a JSON list of
--   { url, public_id, width, height, bytes, added_at, added_by_name }.
--
-- No new access rules: they are part of the venue row, so whoever can see the
-- venue sees them and whoever can edit the venue can change them (062–063).
-- Safe to run repeatedly.
-- ============================================================================

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS business_proof TEXT,
  ADD COLUMN IF NOT EXISTS business_proof_images JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.venues DROP CONSTRAINT IF EXISTS chk_venue_business_proof;
ALTER TABLE public.venues
  ADD CONSTRAINT chk_venue_business_proof CHECK (business_proof IS NULL OR length(business_proof) <= 10000);

-- Keep the lists sane: lists, and not hundreds of pictures on one venue.
ALTER TABLE public.venues DROP CONSTRAINT IF EXISTS chk_venue_photos;
ALTER TABLE public.venues
  ADD CONSTRAINT chk_venue_photos CHECK (
    jsonb_typeof(photos) = 'array' AND jsonb_array_length(photos) <= 100
  );

ALTER TABLE public.venues DROP CONSTRAINT IF EXISTS chk_venue_business_proof_images;
ALTER TABLE public.venues
  ADD CONSTRAINT chk_venue_business_proof_images CHECK (
    jsonb_typeof(business_proof_images) = 'array' AND jsonb_array_length(business_proof_images) <= 20
  );
