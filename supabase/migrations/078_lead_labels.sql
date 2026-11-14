-- ============================================================================
-- VEBOSSO EMS — Labels on Navgrah leads (078)
-- ============================================================================
-- A lead can carry one label ("Not picked", "Interested", "Booked"…), so the
-- list can be split label by label. Labels are one shared list, like
-- banquets: everyone with Leads access sees them; adding / renaming /
-- removing one follows the same rules as banquets (062). Removing a label
-- leaves its leads without one. Setting a lead's label is an edit of the
-- lead, so the leads rules (062) decide who can.
-- Safe to run repeatedly.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.lead_labels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_lead_label_name CHECK (length(trim(name)) BETWEEN 1 AND 40)
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_lead_label_name ON public.lead_labels (lower(trim(name)));

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS label_id UUID REFERENCES public.lead_labels(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_leads_label ON public.leads(label_id);

ALTER TABLE public.lead_labels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lead_labels_read" ON public.lead_labels;
DROP POLICY IF EXISTS "lead_labels_add" ON public.lead_labels;
DROP POLICY IF EXISTS "lead_labels_edit" ON public.lead_labels;
DROP POLICY IF EXISTS "lead_labels_delete" ON public.lead_labels;

CREATE POLICY "lead_labels_read" ON public.lead_labels
  FOR SELECT TO authenticated
  USING (public.has_feature('leads'));
CREATE POLICY "lead_labels_add" ON public.lead_labels
  FOR INSERT TO authenticated
  WITH CHECK (public.access_list_ok('leads', 'add'));
CREATE POLICY "lead_labels_edit" ON public.lead_labels
  FOR UPDATE TO authenticated
  USING (public.access_list_ok('leads', 'edit'))
  WITH CHECK (public.access_list_ok('leads', 'edit'));
CREATE POLICY "lead_labels_delete" ON public.lead_labels
  FOR DELETE TO authenticated
  USING (public.access_list_ok('leads', 'delete'));

-- Live updates on the Leads screen, like banquets.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'lead_labels'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_labels;
  END IF;
END $$;
