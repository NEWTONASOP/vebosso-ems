-- ============================================================================
-- VEBOSSO EMS — Profile Photos (021)
-- ============================================================================
-- `avatars` bucket for profile pictures. Public-read, so avatars load anywhere
-- in the app without signing a URL per person; file names are random, so a
-- picture can only be found through the app. Everyone writes only inside their
-- own "<user_id>/" folder; the owner can manage anyone's.
--
-- profiles.avatar_url already exists and is not locked by
-- prevent_privilege_escalation, so people can set their own.
-- Safe to run repeatedly.
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880, -- 5MB
  '{"image/jpeg", "image/png", "image/webp", "image/heic"}'
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "avatars_owner_all" ON storage.objects;
CREATE POLICY "avatars_owner_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'avatars' AND public.is_owner())
  WITH CHECK (bucket_id = 'avatars' AND public.is_owner());

DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Listing/reading through the API (public URLs don't need this).
DROP POLICY IF EXISTS "avatars_read" ON storage.objects;
CREATE POLICY "avatars_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');

-- Removing a profile also removes their photos.
CREATE OR REPLACE FUNCTION public.cleanup_user_storage_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id IN ('checkouts', 'documents', 'avatars')
  AND (storage.foldername(name))[1] = OLD.id::text;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
