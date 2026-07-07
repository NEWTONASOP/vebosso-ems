-- ============================================================================
-- VEBOSSO EMS — Add Checkout Photos and Storage Bucket
-- ============================================================================

-- 1. Add check_out_photos column to work_logs
ALTER TABLE public.work_logs ADD COLUMN IF NOT EXISTS check_out_photos TEXT[] DEFAULT '{}';

-- 2. Create checkouts bucket if it doesn't exist (private bucket)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'checkouts',
  'checkouts',
  false, -- private bucket
  10485760, -- 10MB limit (will compress client-side anyway)
  '{"image/jpeg", "image/png", "image/gif", "image/webp"}'
)
ON CONFLICT (id) DO NOTHING;

-- 3. Create RLS policies for checkouts bucket
DROP POLICY IF EXISTS "Allow users to upload checkout photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to read checkout photos" ON storage.objects;

-- Policy for uploading checkout photos
CREATE POLICY "Allow users to upload checkout photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'checkouts' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy for reading checkout photos (author, manager, owner)
CREATE POLICY "Allow users to read checkout photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'checkouts' AND (
      (storage.foldername(name))[1] = auth.uid()::text OR
      public.get_user_role() = 'manager' OR
      public.is_owner()
    )
  );
