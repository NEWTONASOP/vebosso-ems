-- ============================================================================
-- VEBOSSO EMS — Owner inbox: new self-added tasks (073)
-- ============================================================================
-- A task someone adds for themselves shows in the owner's "Needs you now"
-- until the owner marks it seen (or comments). owner_seen records that.
-- Only a reviewer (owner / the person's manager) may change it.
-- Safe to run repeatedly. Needs 072.
-- ============================================================================

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS owner_seen BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_tasks_self_unseen ON public.tasks(created_at)
  WHERE self_added AND NOT owner_seen;

-- The guard from 072, now also keeping owner_seen to reviewers.
CREATE OR REPLACE FUNCTION public.tasks_review_guard()
RETURNS TRIGGER AS $fn$
DECLARE
  v_own_open BOOLEAN;
BEGIN
  -- Service role / edge functions have no signed-in user.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Reviewers: the owner, the person's manager, or whoever gave the task —
  -- except on a task people gave themselves, where the assignee is never the reviewer.
  IF public.is_owner()
     OR public.is_manager_of(OLD.assigned_to)
     OR (OLD.assigned_by = auth.uid() AND NOT OLD.self_added) THEN
    RETURN NEW;
  END IF;

  IF NEW.self_added IS DISTINCT FROM OLD.self_added
     OR NEW.owner_seen IS DISTINCT FROM OLD.owner_seen THEN
    RAISE EXCEPTION 'SECURITY: You can only update the status and your note on a task.';
  END IF;

  -- On their own task, still open: the person may reword it.
  v_own_open := OLD.self_added AND OLD.assigned_to = auth.uid()
                AND OLD.status IN ('pending', 'in_progress');

  IF (NOT v_own_open AND (
        NEW.title IS DISTINCT FROM OLD.title
        OR NEW.description IS DISTINCT FROM OLD.description
        OR NEW.due_date IS DISTINCT FROM OLD.due_date))
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
    RAISE EXCEPTION 'SECURITY: This task is waiting for review; only the reviewer can change it.';
  END IF;

  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- The trigger from 037, re-made so the guard is on even if 037 never ran here.
DROP TRIGGER IF EXISTS trg_tasks_review_guard ON public.tasks;
CREATE TRIGGER trg_tasks_review_guard
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_review_guard();
