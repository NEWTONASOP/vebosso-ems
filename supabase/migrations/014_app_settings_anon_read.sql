-- ============================================================================
-- VEBOSSO EMS — Allow Update Checks While Logged Out
--   - Enable anonymous read of only version control keys:
--       latest_version, download_url
--   - Prevents leaking other app_settings values to unauthenticated users
-- ============================================================================

-- Anonymous (logged-out) users must be able to read version controls
-- so UpdateChecker can run on the login screen.
CREATE POLICY "anon_read_version_controls" ON public.app_settings
  FOR SELECT USING (
    auth.role() = 'anon'
    AND key IN ('latest_version', 'download_url')
  );

