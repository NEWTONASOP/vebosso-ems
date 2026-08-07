-- ============================================================================
-- VEBOSSO EMS — Add Check-in Photos
-- Same storage bucket as checkout photos (user-scoped RLS already covers it).
-- ============================================================================

ALTER TABLE public.work_logs
  ADD COLUMN IF NOT EXISTS check_in_photos TEXT[] DEFAULT '{}';
