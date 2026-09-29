-- ============================================================================
-- VEBOSSO EMS — Deleting a member failed ("Edge Function returned a non-2xx")
-- ============================================================================
-- The profile-delete trigger removed the member's files with
--   DELETE FROM storage.objects ...
-- Supabase now rejects direct deletes on the storage tables ("Direct deletion
-- from storage tables is not allowed. Use the Storage API instead."), which
-- aborted the whole member delete. The admin-update-member edge function now
-- removes the files through the Storage API before deleting the user, so the
-- trigger becomes a no-op (kept so nothing else that references it breaks).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_user_storage_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
