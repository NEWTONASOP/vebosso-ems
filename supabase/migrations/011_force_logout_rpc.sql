-- ============================================================================
-- VEBOSSO EMS — Force Logout Database RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.force_logout_user(target_user_id UUID)
RETURNS void AS $$
BEGIN
  -- Delete all sessions and refresh tokens from Supabase Auth schema
  DELETE FROM auth.sessions WHERE user_id::text = target_user_id::text;
  DELETE FROM auth.refresh_tokens WHERE user_id::text = target_user_id::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
