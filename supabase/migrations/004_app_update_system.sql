-- ============================================================================
-- App Update System
-- ============================================================================
-- Stores the latest app version and download URL for in-app update notifications

CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read app settings
CREATE POLICY "anyone_can_read_app_settings" ON public.app_settings
  FOR SELECT USING (true);

-- Insert initial values
INSERT INTO public.app_settings (key, value) VALUES
  ('latest_version', '1.0.1'),
  ('download_url', 'https://github.com/newtane/vebosso-ems/releases/latest')
ON CONFLICT (key) DO NOTHING;

-- Function to automatically update timestamp
CREATE OR REPLACE FUNCTION update_app_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_app_settings_timestamp
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_app_settings_timestamp();
