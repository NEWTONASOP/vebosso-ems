-- ============================================================================
-- VEBOSSO EMS — Version Control for Forced Updates
-- ============================================================================

-- Add version control settings to app_settings table
INSERT INTO public.app_settings (key, value) VALUES
  ('minimum_app_version', '1.0.0'),
  ('latest_app_version', '1.0.0'),
  ('update_message', 'A new version is available. Please update to continue using the app.'),
  ('apk_download_url', 'https://github.com/NEWTONASOP/vebosso-ems/releases/latest/download/app.apk')
ON CONFLICT (key) DO NOTHING;

-- Add comment explaining version control
COMMENT ON TABLE public.app_settings IS 'Global app configuration including version control for forced updates. 
- minimum_app_version: Users below this version will be forced to update
- latest_app_version: Latest available version (informational)
- update_message: Custom message to show users when update is required';
