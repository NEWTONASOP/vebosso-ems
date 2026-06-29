-- ============================================================================
-- VEBOSSO EMS — Allow users to read their own profile
-- ============================================================================
-- Ensures every authenticated user can fetch their profile on login,
-- regardless of role (fixes chicken-and-egg with role-based RLS policies).

CREATE POLICY "user_read_own_profile" ON public.profiles
  FOR SELECT USING (id = auth.uid());
