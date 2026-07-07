-- ============================================================================
-- VEBOSSO EMS — Attendance Backfill Permissions Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.backfill_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  allowed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_used BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT unique_user_date_permission UNIQUE (user_id, date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_backfill_permissions_user ON public.backfill_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_backfill_permissions_date ON public.backfill_permissions(date);
CREATE INDEX IF NOT EXISTS idx_backfill_permissions_user_date ON public.backfill_permissions(user_id, date);

-- Enable RLS
ALTER TABLE public.backfill_permissions ENABLE ROW LEVEL SECURITY;

-- 1. Owner can do everything with backfill_permissions
CREATE POLICY "owner_full_access_backfills" ON public.backfill_permissions
  FOR ALL TO authenticated
  USING (public.is_owner());

-- 2. Members/Managers can view their own backfill_permissions
CREATE POLICY "user_read_own_backfills" ON public.backfill_permissions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 3. Update compute_work_log_hours trigger to also run on INSERT (for backfills)
DROP TRIGGER IF EXISTS compute_work_log_hours ON public.work_logs;
CREATE TRIGGER compute_work_log_hours
  BEFORE INSERT OR UPDATE ON public.work_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.compute_total_hours();
