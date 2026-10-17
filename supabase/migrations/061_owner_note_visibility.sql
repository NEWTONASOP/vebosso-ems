-- ============================================================================
-- 061 — Owner note: optionally visible to the employee
-- The owner's note on a person (053) is owner-only. This adds a switch: when
-- visible_to_employee is on, that person can READ it (never change it) in
-- their own "My details". Off by default.
-- ============================================================================

ALTER TABLE public.employee_owner_notes
  ADD COLUMN IF NOT EXISTS visible_to_employee BOOLEAN NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "employee_owner_notes_self_read" ON public.employee_owner_notes;
CREATE POLICY "employee_owner_notes_self_read" ON public.employee_owner_notes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND visible_to_employee = true);
