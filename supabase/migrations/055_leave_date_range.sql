-- ============================================================================
-- VEBOSSO EMS — Leave for several days in one request (055)
-- ============================================================================
-- leave_requests.date is the first day; end_date the last (null = just that
-- one day). One request, approved or declined as a whole. Up to 60 days.
-- Safe to run repeatedly.
-- ============================================================================

ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS end_date DATE;

ALTER TABLE public.leave_requests DROP CONSTRAINT IF EXISTS chk_leave_end_date;
ALTER TABLE public.leave_requests
  ADD CONSTRAINT chk_leave_end_date
  CHECK (end_date IS NULL OR (end_date >= date AND end_date <= date + 59));

CREATE INDEX IF NOT EXISTS idx_leave_requests_end_date ON public.leave_requests(end_date);
