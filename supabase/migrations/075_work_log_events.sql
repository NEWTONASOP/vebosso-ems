-- ============================================================================
-- VEBOSSO EMS — Attendance log: what was sent, sent back, and sent again (075)
-- ============================================================================
-- A work log row only ever holds the LATEST plan, report and reason. So when a
-- check-in or check-out is sent back and the person sends it again, what was
-- sent before (and why it was sent back) is overwritten and gone.
--
-- work_log_events keeps that history. A trigger on work_logs writes one row per
-- step, in the database, so it is the same for every app version and cannot be
-- forged from the client:
--
--   check_in             a check-in was sent (the plan), including again after
--                        it was sent back
--   plan_updated         the plan was changed
--   check_in_sent_back   an owner / manager sent the check-in back (the reason)
--   check_out            a check-out was sent (the day report)
--   check_out_sent_back  an owner / manager sent the check-out back (the reason)
--
-- Who may read a row: whoever may read its work log (the policy asks work_logs,
-- so it follows work_logs' own row level security). Nobody can write directly.
-- actor_name is stored on the row because a member cannot read other people's
-- profiles. History starts when this runs; earlier days keep their old display.
-- Safe to run repeatedly.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.work_log_events (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seq          BIGINT GENERATED ALWAYS AS IDENTITY,
  work_log_id  UUID NOT NULL REFERENCES public.work_logs(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN (
                 'check_in', 'plan_updated', 'check_in_sent_back',
                 'check_out', 'check_out_sent_back')),
  -- The plan, the day report or the reason, depending on kind.
  body         TEXT,
  actor_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name   TEXT,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_log_events_log
  ON public.work_log_events (work_log_id, occurred_at, seq);

ALTER TABLE public.work_log_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "work_log_events_read" ON public.work_log_events;
CREATE POLICY "work_log_events_read" ON public.work_log_events
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.work_logs w WHERE w.id = work_log_events.work_log_id));
-- No INSERT / UPDATE / DELETE policy: only the trigger below writes.


-- ----------------------------------------------------------------------------
-- Writer (private: not callable from the app)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_work_log_event(
  p_work_log_id UUID,
  p_kind        TEXT,
  p_body        TEXT,
  p_actor       UUID,
  p_at          TIMESTAMPTZ
) RETURNS VOID AS $$
  INSERT INTO public.work_log_events (work_log_id, kind, body, actor_id, actor_name, occurred_at)
  VALUES (
    p_work_log_id,
    p_kind,
    NULLIF(btrim(p_body), ''),
    p_actor,
    (SELECT full_name FROM public.profiles WHERE id = p_actor),
    COALESCE(p_at, now())
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.add_work_log_event(UUID, TEXT, TEXT, UUID, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;


-- ----------------------------------------------------------------------------
-- Trigger: record the steps of a day
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_work_log_events()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.check_in_time IS NOT NULL THEN
      PERFORM public.add_work_log_event(NEW.id, 'check_in', NEW.check_in_plan, NEW.user_id, NEW.check_in_time);
    END IF;
    -- A back-dated day (backfill) arrives already checked out.
    IF NEW.check_out_time IS NOT NULL THEN
      PERFORM public.add_work_log_event(NEW.id, 'check_out', NEW.day_report, NEW.user_id, NEW.check_out_time);
    END IF;
    RETURN NEW;
  END IF;

  -- Check-in sent back by an owner / manager.
  IF NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN
    PERFORM public.add_work_log_event(
      NEW.id, 'check_in_sent_back', NEW.rejection_reason,
      COALESCE(NEW.check_in_approved_by, auth.uid()), now());
  END IF;

  -- Check-in sent again after being sent back (redo_check_in, 048) …
  IF OLD.status = 'rejected' AND NEW.status = 'pending_approval' THEN
    PERFORM public.add_work_log_event(
      NEW.id, 'check_in', NEW.check_in_plan, NEW.user_id, COALESCE(NEW.check_in_time, now()));
  -- … or just the plan changed.
  ELSIF NEW.check_in_plan IS DISTINCT FROM OLD.check_in_plan THEN
    PERFORM public.add_work_log_event(
      NEW.id, 'plan_updated', NEW.check_in_plan, COALESCE(auth.uid(), NEW.user_id), now());
  END IF;

  -- Check-out sent (or sent again).
  IF NEW.check_out_time IS NOT NULL AND NEW.check_out_time IS DISTINCT FROM OLD.check_out_time THEN
    PERFORM public.add_work_log_event(
      NEW.id, 'check_out', NEW.day_report, NEW.user_id, NEW.check_out_time);
  END IF;

  -- Check-out sent back: the day goes from pending_checkout back to working
  -- and the reason is kept. (Needs a reason, so a stray status change is not logged.)
  IF OLD.status = 'pending_checkout' AND NEW.status = 'working' AND NEW.rejection_reason IS NOT NULL THEN
    PERFORM public.add_work_log_event(
      NEW.id, 'check_out_sent_back', NEW.rejection_reason,
      COALESCE(NEW.check_out_approved_by, auth.uid()), now());
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.log_work_log_events() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_log_work_log_events ON public.work_logs;
CREATE TRIGGER trg_log_work_log_events
  AFTER INSERT OR UPDATE ON public.work_logs
  FOR EACH ROW EXECUTE FUNCTION public.log_work_log_events();
