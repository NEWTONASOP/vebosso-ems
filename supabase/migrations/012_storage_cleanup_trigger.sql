-- ============================================================================
-- VEBOSSO EMS — Cleanup Storage on Profile Deletion
-- ============================================================================
-- When an account (profile) is deleted, we should also delete all of their
-- checkout photos from the storage bucket to free up space and ensure 
-- complete data deletion.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_user_storage_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete all objects in 'checkouts' bucket where the root folder matches the user ID
  -- Supabase's internal triggers on storage.objects will handle the physical deletion from S3
  DELETE FROM storage.objects 
  WHERE bucket_id = 'checkouts' 
  AND (storage.foldername(name))[1] = OLD.id::text;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_delete_cleanup_storage ON public.profiles;
CREATE TRIGGER on_profile_delete_cleanup_storage
  BEFORE DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_user_storage_on_delete();
