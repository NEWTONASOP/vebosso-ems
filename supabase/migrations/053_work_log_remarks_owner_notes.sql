-- ============================================================================
-- VEBOSSO EMS — Remarks on check-ins / check-outs, and owner notes (053)
-- ============================================================================
-- 1. work_log_remarks — the owner, or the person's manager, can leave a
--    remark on a check-in or a check-out, even one already approved ("the
--    work in this report wasn't done"). The person sees it and replies once.
--    Whoever left it — or any owner — can remove it afterwards. A remark goes
--    with its day: deleting the work log deletes its remarks.
-- 2. employee_owner_notes — a private note per person on their employee
--    details. Owners only: the person never sees it (it's a separate table,
--    so it can't come along with the details they can read).
-- Safe to run repeatedly.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Remarks
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.work_log_remarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_log_id UUID NOT NULL REFERENCES public.work_logs(id) ON DELETE CASCADE,
  -- Whose day it is — filled in from the work log.
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  part TEXT NOT NULL CHECK (part IN ('check_in', 'check_out')),
  body TEXT NOT NULL,
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  author_name TEXT,
  reply TEXT,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_remark_body CHECK (length(trim(body)) BETWEEN 1 AND 1000),
  CONSTRAINT chk_remark_reply CHECK (reply IS NULL OR length(trim(reply)) BETWEEN 1 AND 1000)
);

CREATE INDEX IF NOT EXISTS idx_work_log_remarks_log ON public.work_log_remarks(work_log_id);
CREATE INDEX IF NOT EXISTS idx_work_log_remarks_user_open ON public.work_log_remarks(user_id) WHERE reply IS NULL;

-- Who it's about, who wrote it and their name come from the database.
CREATE OR REPLACE FUNCTION public.set_work_log_remark_fields()
RETURNS TRIGGER AS $fn$
BEGIN
  SELECT user_id INTO NEW.user_id FROM public.work_logs WHERE id = NEW.work_log_id;
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'That day was not found';
  END IF;
  NEW.author_id := auth.uid();
  SELECT full_name INTO NEW.author_name FROM public.profiles WHERE id = auth.uid();
  NEW.reply := NULL;
  NEW.replied_at := NULL;
  NEW.created_at := now();
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_work_log_remark_fields ON public.work_log_remarks;
CREATE TRIGGER trg_work_log_remark_fields
  BEFORE INSERT ON public.work_log_remarks
  FOR EACH ROW EXECUTE FUNCTION public.set_work_log_remark_fields();

ALTER TABLE public.work_log_remarks ENABLE ROW LEVEL SECURITY;

-- Owner or the person's manager reviews; the person reads their own.
CREATE OR REPLACE FUNCTION public.can_review_day_of(p_user_id UUID)
RETURNS BOOLEAN AS $fn$
  SELECT public.is_owner()
    OR (public.get_user_role() = 'manager' AND public.is_manager_of(p_user_id));
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.can_review_day_of(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_review_day_of(UUID) TO authenticated;

DROP POLICY IF EXISTS "remarks_read" ON public.work_log_remarks;
CREATE POLICY "remarks_read" ON public.work_log_remarks
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_review_day_of(user_id));

-- Checked against the finished row, after the trigger filled in user_id.
DROP POLICY IF EXISTS "remarks_add" ON public.work_log_remarks;
CREATE POLICY "remarks_add" ON public.work_log_remarks
  FOR INSERT TO authenticated
  WITH CHECK (public.can_review_day_of(user_id) AND user_id <> auth.uid());

DROP POLICY IF EXISTS "remarks_remove" ON public.work_log_remarks;
CREATE POLICY "remarks_remove" ON public.work_log_remarks
  FOR DELETE TO authenticated
  USING (public.is_owner() OR author_id = auth.uid());
-- No UPDATE policy: replies go through reply_work_log_remark().

-- The person answers a remark on their own day, once.
CREATE OR REPLACE FUNCTION public.reply_work_log_remark(p_remark_id UUID, p_reply TEXT)
RETURNS public.work_log_remarks AS $fn$
DECLARE
  v_row public.work_log_remarks;
BEGIN
  IF p_reply IS NULL OR length(trim(p_reply)) = 0 THEN
    RAISE EXCEPTION 'Write your reply';
  END IF;
  IF length(trim(p_reply)) > 1000 THEN
    RAISE EXCEPTION 'The reply is too long';
  END IF;

  UPDATE public.work_log_remarks
  SET reply = trim(p_reply), replied_at = now()
  WHERE id = p_remark_id AND user_id = auth.uid() AND reply IS NULL
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'This remark was removed, or you already replied';
  END IF;
  RETURN v_row;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.reply_work_log_remark(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reply_work_log_remark(UUID, TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. Owner notes on employee details
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.employee_owner_notes (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  note TEXT NOT NULL DEFAULT '',
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_owner_note_length CHECK (length(note) <= 3000)
);

DROP TRIGGER IF EXISTS set_employee_owner_notes_updated_at ON public.employee_owner_notes;
CREATE TRIGGER set_employee_owner_notes_updated_at
  BEFORE UPDATE ON public.employee_owner_notes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.employee_owner_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee_owner_notes_owner_all" ON public.employee_owner_notes;
CREATE POLICY "employee_owner_notes_owner_all" ON public.employee_owner_notes
  FOR ALL TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());
