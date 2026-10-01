-- ============================================================================
-- VEBOSSO EMS — Task review: approve or reject finished tasks (037)
-- ============================================================================
-- A person finishing a task now sends it for review (status 'review') instead
-- of closing it. Whoever gave the task — or the owner, or the person's manager —
-- approves it (status 'done') or rejects it with a reason, which puts it back
-- to 'pending' so it has to be done again. The reason stays on the task and is
-- shown to the person.
--
-- Editing a task (title, description, due date) needs no database change: the
-- owner and managers already have full access to tasks (002).
-- Safe to run repeatedly.
-- ============================================================================

-- 1. New state and review fields
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('pending', 'in_progress', 'review', 'done'));

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS chk_task_rejection_reason;
ALTER TABLE public.tasks
  ADD CONSTRAINT chk_task_rejection_reason
  CHECK (rejection_reason IS NULL OR length(rejection_reason) <= 1000);

-- 2. Who may change what.
-- The person a task is given to may only move it along: pending/running →
-- running or review. Closing it ('done') is the reviewer's call, so an attempt
-- to mark it done becomes a review request — that also keeps app versions from
-- before this change working. They cannot touch the text, assignee, due date,
-- voice note or the review fields. The reviewer is the owner, whoever gave the
-- task, or the person's manager.
CREATE OR REPLACE FUNCTION public.tasks_review_guard()
RETURNS TRIGGER AS $fn$
BEGIN
  -- Service role / edge functions have no signed-in user.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.is_owner()
     OR OLD.assigned_by = auth.uid()
     OR public.is_manager_of(OLD.assigned_to) THEN
    RETURN NEW;
  END IF;

  IF NEW.title IS DISTINCT FROM OLD.title
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.due_date IS DISTINCT FROM OLD.due_date
     OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
     OR NEW.assigned_by IS DISTINCT FROM OLD.assigned_by
     OR NEW.work_log_id IS DISTINCT FROM OLD.work_log_id
     OR NEW.voice_path IS DISTINCT FROM OLD.voice_path
     OR NEW.voice_ms IS DISTINCT FROM OLD.voice_ms
     OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
     OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
     OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at THEN
    RAISE EXCEPTION 'SECURITY: You can only update the status and your note on a task.';
  END IF;

  IF NEW.status = 'done' AND OLD.status IS DISTINCT FROM 'done' THEN
    NEW.status := 'review';
  END IF;

  -- Once sent for review or approved, it is the reviewer's.
  IF OLD.status IN ('review', 'done') AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'SECURITY: This task is waiting for review; only the person who gave it can change it.';
  END IF;

  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_tasks_review_guard ON public.tasks;
CREATE TRIGGER trg_tasks_review_guard
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_review_guard();
