-- ============================================================================
-- VEBOSSO EMS — Fix tasks.assigned_by to allow NULL
-- ============================================================================
-- When a member is deleted, tasks they assigned to others should not be
-- deleted — they should just lose the assigned_by reference. This requires
-- assigned_by to be nullable and use ON DELETE SET NULL.
-- ============================================================================

-- Drop the old NOT NULL + CASCADE constraint
ALTER TABLE public.tasks
  ALTER COLUMN assigned_by DROP NOT NULL;

-- Drop the existing FK and recreate with ON DELETE SET NULL
ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_assigned_by_fkey;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_assigned_by_fkey
  FOREIGN KEY (assigned_by)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;
