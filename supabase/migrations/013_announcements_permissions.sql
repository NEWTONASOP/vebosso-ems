-- ============================================================================
-- VEBOSSO EMS — Announcements Permission Fix
--   - Managers cannot insert announcements
--   - Owners can insert and delete announcements
-- ============================================================================

-- Managers must not be able to "put" (create) announcements
DROP POLICY IF EXISTS "manager_insert_announcements" ON public.announcements;

-- Owner insert is allowed and restricted to rows they create
CREATE POLICY "owner_insert_announcements" ON public.announcements
  FOR INSERT WITH CHECK (
    public.is_owner()
    AND created_by = auth.uid()
  );

-- Owner can delete announcements
CREATE POLICY "owner_delete_announcements" ON public.announcements
  FOR DELETE USING (
    public.is_owner()
  );

