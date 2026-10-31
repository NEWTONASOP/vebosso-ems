-- ============================================================================
-- VEBOSSO EMS — Self-added tasks + task comments (072)
-- ============================================================================
-- 1. Members and managers can add tasks for themselves (self_added = true).
--    They go through the same review as boss tasks, but nobody is their own
--    reviewer: a member's task is approved by the owner or their manager, a
--    manager's by the owner. They may edit their own task until it is sent
--    for review.
-- 2. Comments on self-added tasks: written by the owner or the person's
--    manager; the person reads them.
-- Safe to run repeatedly.
-- ============================================================================

-- 1. Tasks ------------------------------------------------------------------
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS self_added BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_tasks_self_added ON public.tasks(self_added) WHERE self_added;

-- A member or manager adds a task for themselves — nothing else.
DROP POLICY IF EXISTS "member_insert_own_self_tasks" ON public.tasks;
CREATE POLICY "member_insert_own_self_tasks" ON public.tasks
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('member', 'manager')
    AND self_added
    AND assigned_to = auth.uid()
    AND assigned_by = auth.uid()
    AND status = 'pending'
  );

-- ...and may delete it while it is still being worked on.
DROP POLICY IF EXISTS "member_delete_own_self_tasks" ON public.tasks;
CREATE POLICY "member_delete_own_self_tasks" ON public.tasks
  FOR DELETE USING (
    public.get_user_role() IN ('member', 'manager')
    AND self_added
    AND assigned_to = auth.uid()
    AND status IN ('pending', 'in_progress')
  );

-- Who may change what (replaces the guard from 037).
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

  IF NEW.self_added IS DISTINCT FROM OLD.self_added THEN
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

-- 2. Comments ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(btrim(body)) > 0 AND length(body) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task ON public.task_comments(task_id, created_at);

-- Who can see a task (and so read / write its comments).
CREATE OR REPLACE FUNCTION public.can_see_task(p_task_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = p_task_id
      AND (
        public.is_owner()
        OR t.assigned_to = auth.uid()
        OR t.assigned_by = auth.uid()
        OR public.is_manager_of(t.assigned_to)
      )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_comments_read" ON public.task_comments;
CREATE POLICY "task_comments_read" ON public.task_comments
  FOR SELECT USING (public.can_see_task(task_id));

DROP POLICY IF EXISTS "task_comments_insert" ON public.task_comments;
CREATE POLICY "task_comments_insert" ON public.task_comments
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_id
        AND t.self_added
        AND t.assigned_to <> auth.uid()
        AND (public.is_owner() OR public.is_manager_of(t.assigned_to))
    )
  );

DROP POLICY IF EXISTS "task_comments_delete" ON public.task_comments;
CREATE POLICY "task_comments_delete" ON public.task_comments
  FOR DELETE USING (author_id = auth.uid() OR public.is_owner());
